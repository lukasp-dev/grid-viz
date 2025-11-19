"""
Line Switching Analysis Tool
Analyzes why lines were switched off in OPF optimization results
"""

import os
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Set
import opf_solver

# Set Gurobi license
os.environ["GRB_LICENSE_FILE"] = "/Users/a/Desktop/VIP/sc-opf/API key/gurobi.lic"

# Load case data
DATA_PATH = "data/pglib_opf_case57_ieee.m"
bus_df, gen_df, branch_df, gencost_df = opf_solver.load_case_data(DATA_PATH)


def get_line_name(fbus: int, tbus: int, branch_id: int = None) -> str:
    """Get line name in format fbus→tbus"""
    if branch_id is not None:
        return f"{branch_id}: {fbus}→{tbus}"
    return f"{fbus}→{tbus}"


def analyze_congestion(
    result: Dict,
    branch_df: pd.DataFrame,
    gen_df: pd.DataFrame,
    bus_df: pd.DataFrame,
    threshold: float = 0.95
) -> Dict:
    """
    Analyze congestion in the network
    
    Args:
        result: Optimization result dictionary
        branch_df: Branch data
        threshold: Utilization threshold for congestion (default: 95%)
    
    Returns:
        Dictionary with congestion analysis
    """
    branches = result['branches']
    congested_lines = []
    
    for branch_id, branch_data in branches.items():
        if branch_data['status'] > 0.5:  # Line is ON
            utilization = branch_data['utilization']
            if utilization >= threshold * 100:
                congested_lines.append({
                    'id': branch_id,
                    'fbus': branch_data['fbus'],
                    'tbus': branch_data['tbus'],
                    'flow': branch_data['flow'],
                    'capacity': branch_data['capacity'],
                    'utilization': utilization
                })
    
    return {
        'congested_lines': congested_lines,
        'num_congested': len(congested_lines)
    }


def trace_power_flow_downstream(
    result: Dict,
    branch_df: pd.DataFrame,
    bus_df: pd.DataFrame,
    start_bus: int,
    visited: Set[int] = None
) -> List[Dict]:
    """
    Trace power flow downstream from a starting bus to find congested lines
    
    Args:
        result: Optimization result dictionary
        branch_df: Branch data
        bus_df: Bus data
        start_bus: Starting bus number
        visited: Set of visited buses (for recursion)
    
    Returns:
        List of branches in the flow path
    """
    if visited is None:
        visited = set()
    
    if start_bus in visited:
        return []
    
    visited.add(start_bus)
    path = []
    
    # Find all outgoing branches from this bus
    branches = result['branches']
    for branch_id, branch_data in branches.items():
        if branch_data['status'] > 0.5:  # Line is ON
            if branch_data['fbus'] == start_bus:
                next_bus = branch_data['tbus']
                path.append({
                    'branch_id': branch_id,
                    'from_bus': start_bus,
                    'to_bus': next_bus,
                    'flow': branch_data['flow'],
                    'capacity': branch_data['capacity'],
                    'utilization': branch_data['utilization']
                })
                # Recursively trace downstream
                downstream = trace_power_flow_downstream(
                    result, branch_df, bus_df, next_bus, visited
                )
                path.extend(downstream)
    
    return path


def find_alternative_paths(
    result: Dict,
    fbus: int,
    tbus: int,
    exclude_branch_id: int = None,
    max_depth: int = 3
) -> List[List[int]]:
    """
    Find alternative paths between two buses
    
    Args:
        result: Optimization result dictionary
        fbus: From bus
        tbus: To bus
        exclude_branch_id: Branch ID to exclude from search
        max_depth: Maximum path depth
    
    Returns:
        List of alternative paths (list of branch IDs)
    """
    branches = result['branches']
    paths = []
    
    def dfs(current_bus: int, target_bus: int, path: List[int], visited: Set[int], depth: int):
        if depth > max_depth:
            return
        if current_bus == target_bus:
            paths.append(path.copy())
            return
        
        visited.add(current_bus)
        
        for branch_id, branch_data in branches.items():
            if branch_id == exclude_branch_id:
                continue
            if branch_data['status'] < 0.5:  # Skip OFF lines
                continue
            
            next_bus = None
            if branch_data['fbus'] == current_bus and branch_data['tbus'] not in visited:
                next_bus = branch_data['tbus']
            elif branch_data['tbus'] == current_bus and branch_data['fbus'] not in visited:
                next_bus = branch_data['fbus']
            
            if next_bus is not None:
                path.append(branch_id)
                dfs(next_bus, target_bus, path, visited, depth + 1)
                path.pop()
        
        visited.remove(current_bus)
    
    dfs(fbus, tbus, [], set(), 0)
    return paths


def analyze_switched_off_lines(
    result: Dict,
    branch_df: pd.DataFrame,
    gen_df: pd.DataFrame,
    bus_df: pd.DataFrame
) -> Dict:
    """
    Analyze why lines were switched off
    
    Args:
        result: Optimization result dictionary
        branch_df: Branch data
        gen_df: Generator data
        bus_df: Bus data
    
    Returns:
        Dictionary with analysis of switched-off lines
    """
    branches = result['branches']
    switched_off = []
    
    for branch_id, branch_data in branches.items():
        if branch_data['status'] < 0.5:  # Line is OFF
            fbus = branch_data['fbus']
            tbus = branch_data['tbus']
            
            # Get branch information
            branch_row = branch_df.loc[branch_id]
            
            # Analyze reasons
            reasons = []
            explanations = []
            
            # 1. Check if there are parallel lines (same fbus and tbus)
            parallel_lines = []
            for other_id, other_data in branches.items():
                if other_id != branch_id and other_data['status'] > 0.5:
                    if other_data['fbus'] == fbus and other_data['tbus'] == tbus:
                        parallel_lines.append({
                            'id': other_id,
                            'flow': other_data['flow'],
                            'capacity': other_data['capacity'],
                            'utilization': other_data['utilization']
                        })
            
            if parallel_lines:
                reasons.append("Parallel line(s) available")
                explanations.append(f"Alternative path exists through parallel line(s): {[p['id'] for p in parallel_lines]}")
            
            # 2. Check for alternative paths
            alternative_paths = find_alternative_paths(result, fbus, tbus, exclude_branch_id=branch_id, max_depth=3)
            if alternative_paths:
                reasons.append("Alternative path available")
                explanations.append(f"Found {len(alternative_paths)} alternative path(s) between buses {fbus} and {tbus}")
            
            # 3. Check congestion on connected lines
            connected_congested = []
            for other_id, other_data in branches.items():
                if other_id != branch_id and other_data['status'] > 0.5:
                    if (other_data['fbus'] == fbus or other_data['tbus'] == tbus or
                        other_data['fbus'] == tbus or other_data['tbus'] == fbus):
                        if other_data['utilization'] > 85:
                            connected_congested.append({
                                'id': other_id,
                                'fbus': other_data['fbus'],
                                'tbus': other_data['tbus'],
                                'flow': other_data['flow'],
                                'capacity': other_data['capacity'],
                                'utilization': other_data['utilization']
                            })
            
            if connected_congested:
                reasons.append("High congestion on connected lines")
                congested_info = [(c['fbus'], c['tbus'], f"{c['utilization']:.1f}%") for c in connected_congested]
                explanations.append(f"Connected lines are heavily loaded: {congested_info}")
            
            # 4. Check if this line would create congestion if turned on
            # (Estimate based on reactance and capacity)
            if branch_row['x'] > 0:
                # High reactance lines are often switched off to reduce losses
                if branch_row['x'] > branch_df['x'].median() * 1.5:
                    reasons.append("High reactance (high losses)")
                    explanations.append(f"Reactance {branch_row['x']:.4f} pu is higher than median, switching off reduces losses")
            
            # 5. Check bus angles - if angle difference would be too large
            bus_angles = result['bus_angles']
            if fbus in bus_angles and tbus in bus_angles:
                angle_diff = abs(bus_angles[fbus] - bus_angles[tbus])
                if angle_diff > 30:  # Large angle difference
                    reasons.append("Large angle difference")
                    explanations.append(f"Angle difference between buses {fbus} and {tbus} is {angle_diff:.1f}°, switching off avoids angle bound violation")
            
            # 6. Check if removing this line reduces flow elsewhere (congestion relief)
            # Find lines that would be congested if this line was on
            # This is heuristic - we check if nearby lines are at capacity
            nearby_at_capacity = []
            for other_id, other_data in branches.items():
                if other_id != branch_id and other_data['status'] > 0.5:
                    # Check if lines share a bus
                    shared_bus = None
                    if other_data['fbus'] == fbus or other_data['fbus'] == tbus:
                        shared_bus = other_data['fbus']
                    elif other_data['tbus'] == fbus or other_data['tbus'] == tbus:
                        shared_bus = other_data['tbus']
                    
                    if shared_bus and other_data['utilization'] > 90:
                        nearby_at_capacity.append({
                            'id': other_id,
                            'bus': shared_bus,
                            'utilization': other_data['utilization']
                        })
            
            if nearby_at_capacity:
                reasons.append("Congestion relief")
                nearby_info = [(n['id'], f"{n['utilization']:.1f}%") for n in nearby_at_capacity]
                explanations.append(f"Switching off relieves congestion on nearby lines: {nearby_info}")
            
            # Determine primary reason
            primary_reason = "Cost optimization"
            if reasons:
                if "Congestion relief" in reasons:
                    primary_reason = "Congestion relief"
                elif "High congestion on connected lines" in reasons:
                    primary_reason = "Avoiding congestion"
                elif "Alternative path available" in reasons or "Parallel line(s) available" in reasons:
                    primary_reason = "Alternative path available"
                elif "Large angle difference" in reasons:
                    primary_reason = "Angle constraint"
                elif "High reactance" in reasons:
                    primary_reason = "Loss reduction"
            
            switched_off.append({
                'id': branch_id,
                'fbus': fbus,
                'tbus': tbus,
                'name': get_line_name(fbus, tbus, branch_id),
                'reactance': branch_row['x'],
                'capacity': branch_data['capacity'],
                'reasons': reasons,
                'explanations': explanations,
                'primary_reason': primary_reason,
                'parallel_lines': parallel_lines,
                'alternative_paths': len(alternative_paths),
                'connected_congested': connected_congested
            })
    
    return {
        'switched_off': switched_off,
        'num_switched_off': len(switched_off)
    }


def classify_congestion(
    result: Dict,
    branch_df: pd.DataFrame,
    gen_df: pd.DataFrame,
    bus_df: pd.DataFrame
) -> Dict:
    """
    Classify congestion as inherent or removable
    
    Args:
        result: Optimization result dictionary
        branch_df: Branch data
        gen_df: Generator data
        bus_df: Bus data
    
    Returns:
        Dictionary with congestion classification
    """
    branches = result['branches']
    congestion_analysis = analyze_congestion(result, branch_df, gen_df, bus_df)
    
    inherent = []
    removable = []
    
    for line in congestion_analysis['congested_lines']:
        branch_id = line['id']
        
        # Check if there are switched-off lines that could help
        # Find nearby switched-off lines
        nearby_off_lines = []
        for other_id, other_data in branches.items():
            if other_data['status'] < 0.5:  # Line is OFF
                # Check if it's connected to the same area
                if (other_data['fbus'] == line['fbus'] or 
                    other_data['tbus'] == line['tbus'] or
                    other_data['fbus'] == line['tbus'] or
                    other_data['tbus'] == line['fbus']):
                    nearby_off_lines.append({
                        'id': other_id,
                        'fbus': other_data['fbus'],
                        'tbus': other_data['tbus']
                    })
        
        if nearby_off_lines:
            removable.append({
                'congested_line': line,
                'potential_relief': nearby_off_lines,
                'classification': 'removable'
            })
        else:
            inherent.append({
                'congested_line': line,
                'classification': 'inherent'
            })
    
    return {
        'inherent': inherent,
        'removable': removable,
        'total_inherent': len(inherent),
        'total_removable': len(removable)
    }


def generate_analysis_report(
    result: Dict,
    branch_df: pd.DataFrame,
    gen_df: pd.DataFrame,
    bus_df: pd.DataFrame,
    scenario_name: str = "Unknown"
) -> str:
    """
    Generate a detailed analysis report
    
    Args:
        result: Optimization result dictionary
        branch_df: Branch data
        gen_df: Generator data
        bus_df: Bus data
        scenario_name: Name of the scenario
    
    Returns:
        Formatted analysis report
    """
    report = []
    report.append("=" * 80)
    report.append(f"LINE SWITCHING ANALYSIS REPORT - {scenario_name}")
    report.append("=" * 80)
    report.append("")
    
    # Basic statistics
    report.append("📊 BASIC STATISTICS")
    report.append("-" * 80)
    report.append(f"Total Lines: {len(result['branches'])}")
    report.append(f"Lines ON: {result['lines_on']}")
    report.append(f"Lines OFF: {result['lines_off']}")
    report.append(f"Objective Cost: ${result['objective']:.2f}")
    report.append(f"Total Generation: {result['total_generation']:.2f} MW")
    report.append(f"Total Load: {result['total_load']:.2f} MW")
    report.append("")
    
    # Switched-off lines analysis
    switched_off_analysis = analyze_switched_off_lines(result, branch_df, gen_df, bus_df)
    report.append("🔴 SWITCHED-OFF LINES - DETAILED ANALYSIS")
    report.append("-" * 80)
    for line in switched_off_analysis['switched_off']:
        report.append(f"\nLine {line['name']} (ID: {line['id']}):")
        report.append(f"  Reactance: {line['reactance']:.4f} pu")
        report.append(f"  Capacity: {line['capacity']:.2f} MVA")
        report.append(f"  Primary Reason: {line['primary_reason']}")
        
        if line['explanations']:
            report.append(f"  Detailed Explanations:")
            for explanation in line['explanations']:
                report.append(f"    • {explanation}")
        
        if line['parallel_lines']:
            report.append(f"  Parallel Lines:")
            for pl in line['parallel_lines']:
                report.append(f"    - Line {pl['id']}: Flow {pl['flow']:.2f} MW, Utilization {pl['utilization']:.1f}%")
        
        if line['alternative_paths'] > 0:
            report.append(f"  Alternative Paths: {line['alternative_paths']} path(s) available")
        
        if line['connected_congested']:
            report.append(f"  Connected Congested Lines:")
            for cc in line['connected_congested']:
                report.append(f"    - Line {cc['id']}: {cc['fbus']}→{cc['tbus']}, Utilization {cc['utilization']:.1f}%")
    report.append("")
    
    # Congestion analysis
    congestion_analysis = analyze_congestion(result, branch_df, gen_df, bus_df)
    report.append("⚠️  CONGESTION ANALYSIS")
    report.append("-" * 80)
    report.append(f"Congested Lines (≥95% utilization): {congestion_analysis['num_congested']}")
    for line in congestion_analysis['congested_lines']:
        report.append(f"  Line {line['id']}: {line['fbus']}→{line['tbus']}")
        report.append(f"    Flow: {line['flow']:.2f} MW / Capacity: {line['capacity']:.2f} MVA")
        report.append(f"    Utilization: {line['utilization']:.1f}%")
    report.append("")
    
    # Congestion classification
    classification = classify_congestion(result, branch_df, gen_df, bus_df)
    report.append("🔍 CONGESTION CLASSIFICATION")
    report.append("-" * 80)
    report.append(f"Inherent Congestion: {classification['total_inherent']}")
    for item in classification['inherent']:
        line = item['congested_line']
        report.append(f"  Line {line['id']}: {line['fbus']}→{line['tbus']} - Cannot be relieved by switching")
    
    report.append(f"\nRemovable Congestion: {classification['total_removable']}")
    for item in classification['removable']:
        line = item['congested_line']
        report.append(f"  Line {line['id']}: {line['fbus']}→{line['tbus']} - Could be relieved by:")
        for relief in item['potential_relief']:
            report.append(f"    - Turning on line {relief['id']}: {relief['fbus']}→{relief['tbus']}")
    report.append("")
    
    # Generator analysis
    report.append("⚡ GENERATOR ANALYSIS")
    report.append("-" * 80)
    for gen_id, gen_data in result['generators'].items():
        utilization = (gen_data['Pg'] / gen_data['Pmax']) * 100 if gen_data['Pmax'] > 0 else 0
        report.append(f"Generator {gen_id} (Bus {gen_data['bus']}):")
        report.append(f"  Output: {gen_data['Pg']:.2f} MW / Max: {gen_data['Pmax']:.2f} MW")
        report.append(f"  Utilization: {utilization:.1f}%")
        if utilization < 100:
            report.append(f"  ⚠️  Not at full capacity - trace downstream for congestion")
    report.append("")
    
    report.append("=" * 80)
    
    return "\n".join(report)


def analyze_scenario(
    constraints: List[str],
    load_multiplier: float = None,
    gen_capacity_multiplier: float = None,
    capacity_limit_multiplier: float = None,
    angle_bound_degrees: float = None,
    scenario_name: str = "Scenario"
) -> str:
    """
    Analyze a specific scenario
    
    Args:
        constraints: List of constraints
        load_multiplier: Load multiplier
        gen_capacity_multiplier: Generator capacity multiplier
        capacity_limit_multiplier: Capacity limit multiplier
        angle_bound_degrees: Angle bound in degrees
        scenario_name: Name of the scenario
    
    Returns:
        Analysis report
    """
    # Prepare data
    modified_bus_df = bus_df.copy()
    modified_gen_df = gen_df.copy()
    
    if load_multiplier is not None:
        modified_bus_df['Pd'] = bus_df['Pd'] * load_multiplier
    
    if gen_capacity_multiplier is not None:
        modified_gen_df['Pmax'] = gen_df['Pmax'] * gen_capacity_multiplier
    
    # Run optimization
    result = opf_solver.solve_dc_opf(
        bus_df=modified_bus_df,
        gen_df=modified_gen_df,
        branch_df=branch_df,
        gencost_df=gencost_df,
        constraints=constraints,
        verbose=False,
        angle_bound_degrees=angle_bound_degrees,
        capacity_limit_multiplier=capacity_limit_multiplier
    )
    
    if result['status'] != 'optimal':
        return f"❌ Optimization failed: {result.get('message', 'Unknown error')}"
    
    # Generate analysis report
    report = generate_analysis_report(result, branch_df, gen_df, bus_df, scenario_name)
    
    # Add detailed switched-off lines list
    report += "\n\n"
    report += "📋 DETAILED SWITCHED-OFF LINES LIST\n"
    report += "-" * 80 + "\n"
    switched_off_lines = []
    for branch_id, branch_data in result['branches'].items():
        if branch_data['status'] < 0.5:
            switched_off_lines.append(f"{branch_data['fbus']}→{branch_data['tbus']}")
    report += ", ".join(switched_off_lines)
    report += "\n"
    
    # Add detailed analysis for specific lines mentioned by user
    # Line 90 might refer to a specific scenario or line ID
    # Check all branches for lines that match user's description
    report += "\n"
    report += "🔍 DETAILED ANALYSIS FOR SPECIFIC LINES\n"
    report += "-" * 80 + "\n"
    
    # Find lines that match user's mentioned lines
    user_mentioned_lines = [
        (30, 31), (9, 12), (14, 46), (44, 45), (54, 55),
        (1, 15), (3, 15), (9, 13), (10, 12), (9, 55),
        (4, 5), (4, 6), (40, 56), (46, 47), (34, 32), (1, 16)
    ]
    
    for fbus, tbus in user_mentioned_lines:
        # Find matching branch
        matching_branches = []
        for branch_id, branch_data in result['branches'].items():
            if (branch_data['fbus'] == fbus and branch_data['tbus'] == tbus) or \
               (branch_data['fbus'] == tbus and branch_data['tbus'] == fbus):
                matching_branches.append((branch_id, branch_data))
        
        if matching_branches:
            for branch_id, branch_data in matching_branches:
                report += f"\nLine {fbus}→{tbus} (ID: {branch_id}):\n"
                report += f"  Status: {'ON' if branch_data['status'] > 0.5 else 'OFF'}\n"
                if branch_data['status'] > 0.5:
                    report += f"  Flow: {branch_data['flow']:.2f} MW\n"
                    report += f"  Capacity: {branch_data['capacity']:.2f} MVA\n"
                    report += f"  Utilization: {branch_data['utilization']:.1f}%\n"
                    if branch_data['utilization'] > 90:
                        report += f"  ⚠️  HIGHLY CONGESTED\n"
                else:
                    # Analyze why it's off
                    branch_row = branch_df.loc[branch_id]
                    report += f"  Reactance: {branch_row['x']:.4f} pu\n"
                    report += f"  Capacity: {branch_data['capacity']:.2f} MVA\n"
                    # Check for alternative paths
                    alt_paths = find_alternative_paths(result, fbus, tbus, exclude_branch_id=branch_id, max_depth=3)
                    if alt_paths:
                        report += f"  Alternative paths: {len(alt_paths)} available\n"
    
    # Also check if there's a branch with ID 90
    if 90 in result['branches']:
        line_90 = result['branches'][90]
        report += f"\n\nLine ID 90 ({line_90['fbus']}→{line_90['tbus']}):\n"
        report += f"  Status: {'ON' if line_90['status'] > 0.5 else 'OFF'}\n"
        if line_90['status'] > 0.5:
            report += f"  Flow: {line_90['flow']:.2f} MW\n"
            report += f"  Capacity: {line_90['capacity']:.2f} MVA\n"
            report += f"  Utilization: {line_90['utilization']:.1f}%\n"
    report += "\n"
    
    return report


if __name__ == "__main__":
    # Analyze the three scenarios mentioned by the user
    scenarios = [
        {
            'name': 'Scenario 1.12',
            'constraints': ['line_switching'],
            'load_multiplier': 1.12,
            'gen_capacity_multiplier': None,
            'capacity_limit_multiplier': None,
            'angle_bound_degrees': None
        },
        {
            'name': 'Scenario 1.13',
            'constraints': ['line_switching'],
            'load_multiplier': 1.13,
            'gen_capacity_multiplier': None,
            'capacity_limit_multiplier': None,
            'angle_bound_degrees': None
        },
        {
            'name': 'Scenario 1.14',
            'constraints': ['line_switching'],
            'load_multiplier': 1.14,
            'gen_capacity_multiplier': None,
            'capacity_limit_multiplier': None,
            'angle_bound_degrees': None
        }
    ]
    
    # Generate comprehensive report
    all_reports = []
    for scenario in scenarios:
        print(f"\n{'='*80}\n")
        print(f"Analyzing {scenario['name']}...")
        report = analyze_scenario(
            constraints=scenario['constraints'],
            load_multiplier=scenario['load_multiplier'],
            gen_capacity_multiplier=scenario['gen_capacity_multiplier'],
            capacity_limit_multiplier=scenario['capacity_limit_multiplier'],
            angle_bound_degrees=scenario['angle_bound_degrees'],
            scenario_name=scenario['name']
        )
        all_reports.append(report)
        print(report)
        print(f"\n{'='*80}\n")
    
    # Save to file
    output_file = "line_switching_analysis_report.txt"
    with open(output_file, 'w') as f:
        f.write("=" * 80 + "\n")
        f.write("COMPREHENSIVE LINE SWITCHING ANALYSIS REPORT\n")
        f.write("=" * 80 + "\n\n")
        for report in all_reports:
            f.write(report)
            f.write("\n" + "=" * 80 + "\n\n")
    
    print(f"\n✅ Analysis complete! Report saved to: {output_file}")

