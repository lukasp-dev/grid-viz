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
    
    # Reference bus
    ref_bus = bus_df[bus_df['type'] == 3]['bus_i'].values[0]
    
    # Determine if line switching is enabled
    line_switching = 'line_switching' in constraints
    angle_bound = 'angle_bound' in constraints
    
    # Big-M value
    M = 1000
    if angle_bound:
        # Use provided angle bound or default to 30 degrees
        angle_bound_deg = angle_bound_degrees if angle_bound_degrees is not None else 30.0
        MAX_ANGLE_DIFF_RAD = np.deg2rad(angle_bound_deg)
        max_susceptance = (1.0 / branch_df['x']).max()
        max_capacity = branch_df['rateA'].max()
        M = max(2 * MAX_ANGLE_DIFF_RAD * max_susceptance, max_capacity * 2)
    
    # Variables
    Pg = model.addVars(gen_df.index, lb=0, name="Pg")
    theta = model.addVars(
        bus_df['bus_i'], 
        lb=-GRB.INFINITY, 
        ub=GRB.INFINITY, 
        name="theta"
    )
    P_branch = model.addVars(
        branch_df.index, 
        lb=-GRB.INFINITY, 
        name="P_branch"
    )
    
    # Line switching binary variables
    if line_switching:
        z = model.addVars(branch_df.index, vtype=GRB.BINARY, name="z")
    else:
        # All lines forced ON
        z = {i: 1 for i in branch_df.index}
    
    # Objective: Minimize generation cost
    obj = gp.QuadExpr()
    for idx, row in gencost_df.iterrows():
        obj += row['c2'] * Pg[idx] * Pg[idx] + row['c1'] * Pg[idx] + row['c0']
    model.setObjective(obj, GRB.MINIMIZE)
    
    # Constraint: Reference bus angle
    model.addConstr(theta[ref_bus] == 0, name="ref_bus")
    
    # Constraint: Generator limits
    for idx, row in gen_df.iterrows():
        model.addConstr(Pg[idx] >= row['Pmin'], name=f"Pg_min_{idx}")
        model.addConstr(Pg[idx] <= row['Pmax'], name=f"Pg_max_{idx}")
    
    # Constraint: DC power flow
    for idx, row in branch_df.iterrows():
        fbus = row['fbus']
        tbus = row['tbus']
        x = row['x']
        B = 1.0 / x  # Susceptance
        
        if line_switching:
            # Big-M formulation
            model.addConstr(
                P_branch[idx] - B * (theta[fbus] - theta[tbus]) <= M * (1 - z[idx]),
                name=f"flow_up_{idx}"
            )
            model.addConstr(
                P_branch[idx] - B * (theta[fbus] - theta[tbus]) >= -M * (1 - z[idx]),
                name=f"flow_lo_{idx}"
            )
            model.addConstr(P_branch[idx] <= M * z[idx], name=f"off_up_{idx}")
            model.addConstr(P_branch[idx] >= -M * z[idx], name=f"off_lo_{idx}")
        else:
            # Simple power flow equation
            model.addConstr(
                P_branch[idx] == B * (theta[fbus] - theta[tbus]),
                name=f"flow_{idx}"
            )
    
    # Constraint: Angle bounds (if enabled)
    if angle_bound:
        # Use provided angle bound or default to 30 degrees
        angle_bound_deg = angle_bound_degrees if angle_bound_degrees is not None else 30.0
        MAX_ANGLE_DIFF_RAD = np.deg2rad(angle_bound_deg)
        for idx, row in branch_df.iterrows():
            fbus = row['fbus']
            tbus = row['tbus']
            
            if line_switching:
                model.addConstr(
                    theta[fbus] - theta[tbus] <= MAX_ANGLE_DIFF_RAD * z[idx],
                    name=f"ang_diff_up_{idx}"
                )
                model.addConstr(
                    theta[fbus] - theta[tbus] >= -MAX_ANGLE_DIFF_RAD * z[idx],
                    name=f"ang_diff_lo_{idx}"
                )
            else:
                model.addConstr(
                    theta[fbus] - theta[tbus] <= MAX_ANGLE_DIFF_RAD,
                    name=f"ang_diff_up_{idx}"
                )
                model.addConstr(
                    theta[fbus] - theta[tbus] >= -MAX_ANGLE_DIFF_RAD,
                    name=f"ang_diff_lo_{idx}"
                )
    
    # Constraint: Line capacity limits
    capacity_multiplier = capacity_limit_multiplier if capacity_limit_multiplier is not None else 1.0
    for idx, row in branch_df.iterrows():
        rateA = row['rateA'] * capacity_multiplier  # Apply capacity multiplier
        if rateA > 0:
            if line_switching:
                model.addConstr(P_branch[idx] <= rateA * z[idx], name=f"cap_up_{idx}")
                model.addConstr(P_branch[idx] >= -rateA * z[idx], name=f"cap_lo_{idx}")
            else:
                model.addConstr(P_branch[idx] <= rateA, name=f"cap_up_{idx}")
                model.addConstr(P_branch[idx] >= -rateA, name=f"cap_lo_{idx}")
    
    # Constraint: Power balance at each bus
    for idx, row in bus_df.iterrows():
        bus = row['bus_i']
        Pd = row['Pd']
        
        # Generation at this bus
        gen_at_bus = gen_df[gen_df['bus'] == bus].index.tolist()
        gen_P = gp.quicksum(Pg[g] for g in gen_at_bus)
        
        # Branch flows
        branch_out = gp.quicksum(
            P_branch[br] for br in branch_df[branch_df['fbus'] == bus].index
        )
        branch_in = gp.quicksum(
            P_branch[br] for br in branch_df[branch_df['tbus'] == bus].index
        )
        
        model.addConstr(
            gen_P - Pd == branch_out - branch_in,
            name=f"balance_{bus}"
        )
    
    # Solve
    model.optimize()
    
    # Extract results
    if model.status == GRB.OPTIMAL:
        # Generator outputs
        gen_outputs = {}
        for idx in gen_df.index:
            gen_outputs[int(idx)] = {
                'bus': int(gen_df.loc[idx, 'bus']),
                'Pg': Pg[idx].X,
                'Pmax': gen_df.loc[idx, 'Pmax'],
                'Pmin': gen_df.loc[idx, 'Pmin']
            }
        
        # Branch flows and switching status
        branch_flows = {}
        for idx in branch_df.iterrows():
            idx_val = idx[0]
            row = idx[1]
            z_value = z[idx_val].X if line_switching else 1
            branch_flows[int(idx_val)] = {
                'fbus': int(row['fbus']),
                'tbus': int(row['tbus']),
                'flow': P_branch[idx_val].X,
                'capacity': row['rateA'],
                'utilization': abs(P_branch[idx_val].X) / row['rateA'] * 100 if row['rateA'] > 0 else 0,
                'status': z_value
            }
        
        # Bus angles
        bus_angles = {}
        for bus in bus_df['bus_i']:
            bus_angles[int(bus)] = theta[bus].X * 180 / np.pi  # Convert to degrees
        
        result = {
            'status': 'optimal',
            'objective': model.ObjVal,
            'total_generation': sum(Pg[i].X for i in gen_df.index),
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

