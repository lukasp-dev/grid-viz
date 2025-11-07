"""
OPF Solver Module for IEEE 57-Bus System
Author: Jewook Park
Date: November 2025

This module provides functions to solve DC-OPF problems with various constraints:
- Original (basic DC-OPF)
- Line Switching
- Angle Bounds
- Capacity Cuts
"""

import os
import re
import numpy as np
import pandas as pd
import gurobipy as gp
from gurobipy import GRB
from typing import Dict, Tuple, List, Any, Optional


def extract_matrix_block(lines: List[str], varname: str) -> np.ndarray:
    """
    Extract matrix data from MATPOWER .m file
    
    Args:
        lines: List of lines from the .m file
        varname: Variable name to extract (e.g., 'mpc.bus')
    
    Returns:
        numpy array with extracted data
    """
    in_block = False
    matrix_lines = []
    
    for line in lines:
        if line.strip().startswith(f"{varname} = ["):
            in_block = True
            continue
        if in_block:
            if line.strip().startswith("];"):
                break
            clean = re.sub(r'%.*', '', line).strip().rstrip(';')
            if clean:
                matrix_lines.append(clean)
    
    matrix_data = []
    for line in matrix_lines:
        row = [float(x) for x in line.split()]
        matrix_data.append(row)
    
    return np.array(matrix_data)


def load_case_data(filepath: str) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Load IEEE case data from MATPOWER file
    
    Args:
        filepath: Path to .m file
    
    Returns:
        Tuple of (bus_df, gen_df, branch_df, gencost_df)
    """
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    bus = extract_matrix_block(lines, 'mpc.bus')
    branch = extract_matrix_block(lines, 'mpc.branch')
    gen = extract_matrix_block(lines, 'mpc.gen')
    gencost = extract_matrix_block(lines, 'mpc.gencost')
    
    bus_df = pd.DataFrame(bus, columns=[
        'bus_i', 'type', 'Pd', 'Qd', 'Gs', 'Bs', 'area', 
        'Vm', 'Va', 'baseKV', 'zone', 'Vmax', 'Vmin'
    ])
    
    gen_df = pd.DataFrame(gen, columns=[
        'bus', 'Pg', 'Qg', 'Qmax', 'Qmin', 'Vg', 
        'mBase', 'status', 'Pmax', 'Pmin'
    ])
    
    branch_df = pd.DataFrame(branch, columns=[
        'fbus', 'tbus', 'r', 'x', 'b', 'rateA', 'rateB', 'rateC',
        'ratio', 'angle', 'status', 'angmin', 'angmax'
    ])
    
    gencost_df = pd.DataFrame(gencost, columns=[
        'model', 'startup', 'shutdown', 'n', 'c2', 'c1', 'c0'
    ])
    
    return bus_df, gen_df, branch_df, gencost_df


def solve_dc_opf(
    bus_df: pd.DataFrame,
    gen_df: pd.DataFrame,
    branch_df: pd.DataFrame,
    gencost_df: pd.DataFrame,
    constraints: List[str] = None,
    verbose: bool = False,
    angle_bound_degrees: Optional[float] = None,
    capacity_limit_multiplier: Optional[float] = None
) -> Dict[str, Any]:
    """
    Solve DC-OPF with specified constraints
    
    Args:
        bus_df: Bus data
        gen_df: Generator data
        branch_df: Branch data
        gencost_df: Generation cost data
        constraints: List of constraints to apply
                    Options: ['line_switching', 'angle_bound', 'capacity']
        verbose: Print Gurobi output
    
    Returns:
        Dictionary with optimization results
    """
    if constraints is None:
        constraints = []
    
    # Create model
    model = gp.Model("DC-OPF-Case57")
    if not verbose:
        model.Params.OutputFlag = 0
    
    # ========== Parameters ==========
    baseMVA = 100.0  # Standard MATPOWER base
    buses = bus_df['bus_i'].values
    branches = branch_df.index
    generators = gen_df.index
    
    # Reference bus
    ref_bus = bus_df[bus_df['type'] == 3]['bus_i'].values[0]
    
    # Determine if line switching is enabled
    line_switching = 'line_switching' in constraints
    
    # Big-M values for switching constraints
    if line_switching:
        M_angle = np.radians(360)  # Conservative angle bound
        M_flow = branch_df['rateA'].max() * 2  # Conservative flow bound
    
    # ========== Decision Variables ==========
    Pg = model.addVars(generators, lb=0, name="Pg")
    theta = model.addVars(
        buses, 
        lb=-GRB.INFINITY, 
        ub=GRB.INFINITY, 
        name="theta"
    )
    P_branch = model.addVars(
        branches, 
        lb=-GRB.INFINITY, 
        ub=GRB.INFINITY,
        name="P_branch"
    )
    
    # Line switching binary variables
    if line_switching:
        z = model.addVars(branches, vtype=GRB.BINARY, name="z")
        # Warm start: all lines ON
        for idx in branches:
            z[idx].start = 1
    
    # ========== 13a. Objective Function ==========
    # Minimize total generation cost: ∑_{i ∈ N} ∑_{j ∈ G_i} c_j * p_j^g
    obj = gp.QuadExpr()
    for idx in generators:
        c2 = gencost_df.loc[idx, 'c2']
        c1 = gencost_df.loc[idx, 'c1']
        c0 = gencost_df.loc[idx, 'c0']
        obj += c2 * Pg[idx] * Pg[idx] + c1 * Pg[idx] + c0
    
    # Optional: small penalty for switching lines off
    if line_switching:
        for idx in branches:
            obj += 1.0 * (1 - z[idx])
    
    model.setObjective(obj, GRB.MINIMIZE)
    
    # ========== Constraints ==========
    
    # 13b. Power Balance at each bus (Nodal Power Conservation)
    # ∑_{j ∈ G_i} p_j^g - ∑_{e ∈ E_i} p_e^f + ∑_{e ∈ E_i^R} p_e^f = ∑_{j ∈ L_i} p_j^d + g_i^s  ∀i ∈ N
    for idx, row in bus_df.iterrows():
        bus = row['bus_i']
        Pd = row['Pd']
        Gs = row['Gs']  # Shunt conductance
        
        # Generation at this bus
        gen_at_bus = gen_df[gen_df['bus'] == bus].index.tolist()
        gen_P = gp.quicksum(Pg[g] for g in gen_at_bus) if gen_at_bus else 0
        
        # Branch flows: outflow from this bus
        branch_out = gp.quicksum(
            P_branch[br] for br in branch_df[branch_df['fbus'] == bus].index
        )
        # Branch flows: inflow to this bus
        branch_in = gp.quicksum(
            P_branch[br] for br in branch_df[branch_df['tbus'] == bus].index
        )
        
        model.addConstr(
            gen_P - branch_out + branch_in == Pd + Gs,
            name=f"power_balance_{int(bus)}"
        )
    
    # 13e. Reference Bus (fixes its voltage angle to zero)
    # θ_ref = 0
    model.addConstr(theta[ref_bus] == 0, name="reference_bus")
    
    # 13f. Generation Limits (active power generation limit at bus_i)
    # p_i^g^min ≤ p_i^g ≤ p_i^g^max  ∀i ∈ G
    for idx, row in gen_df.iterrows():
        model.addConstr(Pg[idx] >= row['Pmin'], name=f"Pg_min_{idx}")
        model.addConstr(Pg[idx] <= row['Pmax'], name=f"Pg_max_{idx}")
    
    # Branch constraints
    for idx, row in branch_df.iterrows():
        fbus = row['fbus']
        tbus = row['tbus']
        x = row['x']
        rateA = row['rateA']
        # Use angle_bound_degrees if provided, otherwise use branch_df values
        if angle_bound_degrees is not None:
            angmin_rad = -np.radians(angle_bound_degrees)
            angmax_rad = np.radians(angle_bound_degrees)
        else:
            angmin_rad = np.radians(row['angmin'])
            angmax_rad = np.radians(row['angmax'])
        
        # Skip zero reactance lines (should be handled separately if present)
        if x == 0:
            model.addConstr(theta[fbus] == theta[tbus], name=f"dc_flow_{idx}_zero_x")
            continue
        
        if line_switching:
            # ===== SWITCHING MODE: Big-M Formulation =====
            
            # 13c.ii. DC Power Flow with Big-M (active power flow on each branch)
            # -M(1-z_e) ≤ -b_e(θ_i - θ_j)*baseMVA - p_e^f ≤ M(1-z_e)  ∀e = (i,j) ∈ E
            # When z_e = 1 (line closed): -b_e(θ_i - θ_j)*baseMVA - p_e^f = 0
            # When z_e = 0 (line open): constraint is relaxed by M
            model.addConstr(
                -(1/x) * (theta[fbus] - theta[tbus]) * baseMVA - P_branch[idx] <= M_flow * (1 - z[idx]),
                name=f"dc_flow_upper_{idx}"
            )
            model.addConstr(
                -(1/x) * (theta[fbus] - theta[tbus]) * baseMVA - P_branch[idx] >= -M_flow * (1 - z[idx]),
                name=f"dc_flow_lower_{idx}"
            )
            
            # 13d. Voltage Angle Difference Limits with Big-M
            # ∆θ_e^min - M(1-z_e) ≤ θ_i - θ_j ≤ ∆θ_e^max + M(1-z_e)  ∀e = (i,j) ∈ E
            # When z_e = 1 (line closed): angle differences are constrained
            # When z_e = 0 (line open): angle differences are decoupled
            if angmin_rad > -GRB.INFINITY:
                model.addConstr(
                    theta[fbus] - theta[tbus] >= angmin_rad - M_angle * (1 - z[idx]),
                    name=f"angle_min_{idx}"
                )
            if angmax_rad < GRB.INFINITY:
                model.addConstr(
                    theta[fbus] - theta[tbus] <= angmax_rad + M_angle * (1 - z[idx]),
                    name=f"angle_max_{idx}"
                )
            
            # 13g. Flow Limits (upper thermal limits) with switching
            # -\bar{S_e} · z_e ≤ p_e^f ≤ \bar{S_e} · z_e  ∀e ∈ E
            # When z_e = 0 (line open): flow p_e^f = 0
            # When z_e = 1 (line closed): flow is bounded by thermal limits
            if rateA > 0:
                capacity_multiplier = capacity_limit_multiplier if capacity_limit_multiplier is not None else 1.0
                rateA_adjusted = rateA * capacity_multiplier
                model.addConstr(P_branch[idx] <= rateA_adjusted * z[idx], name=f"line_max_{idx}")
                model.addConstr(P_branch[idx] >= -rateA_adjusted * z[idx], name=f"line_min_{idx}")
        
        else:
            # ===== BASELINE MODE: All lines fixed ON (z_e = 1) =====
            
            # 13c.i. DC Power Flow (standard, no Big-M)
            # -b_e(θ_i - θ_j)*baseMVA - p_e^f = 0  ∀e = (i,j) ∈ E
            model.addConstr(
                -(1/x) * (theta[fbus] - theta[tbus]) * baseMVA - P_branch[idx] == 0,
                name=f"dc_flow_{idx}"
            )
            
            # 13d. Voltage Angle Difference Limits (standard)
            # ∆θ_e^min ≤ θ_i - θ_j ≤ ∆θ_e^max  ∀e = (i,j) ∈ E
            if angmin_rad > -GRB.INFINITY:
                model.addConstr(
                    theta[fbus] - theta[tbus] >= angmin_rad,
                    name=f"angle_min_{idx}"
                )
            if angmax_rad < GRB.INFINITY:
                model.addConstr(
                    theta[fbus] - theta[tbus] <= angmax_rad,
                    name=f"angle_max_{idx}"
                )
            
            # 13g. Line flow thermal limits (standard)
            # -\bar{S_e} ≤ p_e^f ≤ \bar{S_e}  ∀e ∈ E
            if rateA > 0:
                capacity_multiplier = capacity_limit_multiplier if capacity_limit_multiplier is not None else 1.0
                rateA_adjusted = rateA * capacity_multiplier
                model.addConstr(P_branch[idx] <= rateA_adjusted, name=f"line_max_{idx}")
                model.addConstr(P_branch[idx] >= -rateA_adjusted, name=f"line_min_{idx}")
    
    # Solve
    model.optimize()
    
    # ========== Extract Results ==========
    if model.status == GRB.OPTIMAL:
        # Generator outputs
        gen_outputs = {}
        for idx in generators:
            gen_outputs[int(idx)] = {
                'bus': int(gen_df.loc[idx, 'bus']),
                'Pg': Pg[idx].X,
                'Pmax': gen_df.loc[idx, 'Pmax'],
                'Pmin': gen_df.loc[idx, 'Pmin']
            }
        
        # Branch flows and switching status
        branch_flows = {}
        for idx in branches:
            row = branch_df.loc[idx]
            z_value = z[idx].X if line_switching else 1
            branch_flows[int(idx)] = {
                'fbus': int(row['fbus']),
                'tbus': int(row['tbus']),
                'flow': P_branch[idx].X,
                'capacity': row['rateA'],
                'utilization': abs(P_branch[idx].X) / row['rateA'] * 100 if row['rateA'] > 0 else 0,
                'status': z_value
            }
        
        # Bus angles
        bus_angles = {}
        for bus in buses:
            bus_angles[int(bus)] = theta[bus].X * 180 / np.pi  # Convert to degrees
        
        result = {
            'status': 'optimal',
            'objective': model.ObjVal,
            'total_generation': sum(Pg[i].X for i in generators),
            'total_load': bus_df['Pd'].sum(),
            'generators': gen_outputs,
            'branches': branch_flows,
            'bus_angles': bus_angles,
            'lines_on': sum(1 for b in branch_flows.values() if b['status'] > 0.5) if line_switching else len(branch_df),
            'lines_off': sum(1 for b in branch_flows.values() if b['status'] < 0.5) if line_switching else 0
        }
    else:
        result = {
            'status': 'infeasible' if model.status == GRB.INFEASIBLE else 'error',
            'status_code': model.status,
            'message': f'Optimization failed with status {model.status}'
        }
    
    return result


def get_topology(bus_df: pd.DataFrame, gen_df: pd.DataFrame, branch_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Get network topology data for visualization
    
    Args:
        bus_df: Bus data
        gen_df: Generator data
        branch_df: Branch data
    
    Returns:
        Dictionary with nodes and edges for network graph
    """
    # Nodes
    nodes = []
    gen_buses = set(gen_df['bus'].astype(int))
    ref_bus = int(bus_df[bus_df['type'] == 3]['bus_i'].values[0])
    
    for idx, row in bus_df.iterrows():
        bus_id = int(row['bus_i'])
        node_type = 'slack' if bus_id == ref_bus else ('generator' if bus_id in gen_buses else 'load')
        
        nodes.append({
            'id': bus_id,
            'type': node_type,
            'load': row['Pd'],
            'voltage': row['Vm']
        })
    
    # Edges
    edges = []
    for idx, row in branch_df.iterrows():
        edges.append({
            'id': int(idx),
            'source': int(row['fbus']),
            'target': int(row['tbus']),
            'reactance': row['x'],
            'capacity': row['rateA']
        })
    
    return {
        'nodes': nodes,
        'edges': edges,
        'num_buses': len(bus_df),
        'num_branches': len(branch_df),
        'num_generators': len(gen_df),
        'total_load': bus_df['Pd'].sum()
    }

