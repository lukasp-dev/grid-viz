"""
FastAPI Server for OPF Visualization
Author: Jewook Park
Date: November 2025

This server provides REST API endpoints for:
- Getting network topology
- Running OPF optimization with various constraints
"""

import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import opf_solver

# Set Gurobi license
os.environ["GRB_LICENSE_FILE"] = "/Users/sharafkabir/Desktop/VIP/gurobi.lic"

# Initialize FastAPI
app = FastAPI(
    title="OPF Visualization API",
    description="API for IEEE 57-Bus OPF optimization and visualization",
    version="1.0.0"
)

# Enable CORS for all origins (for React frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load case data on startup
DATA_PATH = "data/pglib_opf_case57_ieee.m"
bus_df, gen_df, branch_df, gencost_df = opf_solver.load_case_data(DATA_PATH)

# Store baseline result for comparison (will be set on first run without switching)
baseline_result = None


def print_switching_comparison_report(baseline_result: dict, switching_result: dict, 
                                     load_mult: float, angle_bound: float):
    """
    Print a comparison report of dual variables for lines that changed status
    between baseline and switching scenarios.
    """
    if not baseline_result or not switching_result:
        return
    
    if baseline_result.get('status') != 'optimal' or switching_result.get('status') != 'optimal':
        return
    
    # Get branches data from both results
    baseline_branches = baseline_result.get('branches', {})
    switching_branches = switching_result.get('branches', {})
    
    if not baseline_branches or not switching_branches:
        return
    
    # Find lines that changed status
    switched_off_lines = []  # ON in baseline, OFF in switching
    switched_on_lines = []   # OFF in baseline, ON in switching
    
    for branch_id in baseline_branches.keys():
        baseline_status = baseline_branches[branch_id].get('status', 1)
        switching_status = switching_branches[branch_id].get('status', 1)
        
        if baseline_status == 1 and switching_status == 0:
            # Line was ON, now OFF
            switched_off_lines.append(branch_id)
        elif baseline_status == 0 and switching_status == 1:
            # Line was OFF, now ON
            switched_on_lines.append(branch_id)
    
    if not switched_off_lines and not switched_on_lines:
        return
    
    # Print report
    print("\n" + "=" * 120)
    print(f"📊 LINE SWITCHING DUAL VARIABLE REPORT")
    print(f"   Load: {load_mult:.2f}x | Angle Bound: {angle_bound:.1f}°")
    print("=" * 120)
    
    # Get dual variables from baseline
    baseline_duals = baseline_result.get('dual_variables', {})
    all_branches_duals = baseline_duals.get('all_branches', [])
    
    if switched_off_lines:
        print(f"\n🔴 LINES SWITCHED OFF ({len(switched_off_lines)} lines):")
        print("-" * 120)
        for branch_id in sorted(switched_off_lines):
            branch_info = baseline_branches[branch_id]
            
            # Get dual info for this branch from the dict
            # all_branches_duals is a dict with integer keys
            dual_info = all_branches_duals.get(branch_id, None)
            
            fbus = branch_info.get('fbus')
            tbus = branch_info.get('tbus')
            flow = branch_info.get('flow', 0)
            capacity = branch_info.get('capacity', 0)
            util = (abs(flow) / capacity * 100) if capacity > 0 else 0
            
            # Get angle difference from dual_info or branch_info
            angle_diff = dual_info.get('angle_diff_deg', 0) if dual_info else 0
            
            print(f"  Branch {branch_id}: ({fbus}, {tbus})")
            print(f"    Baseline: Flow={flow:.2f} MW, Utilization={util:.2f}%, Angle Diff={angle_diff:.4f}°")
            
            if dual_info:
                thermal_max = dual_info.get('thermal_limit_dual_max', 0)
                thermal_min = dual_info.get('thermal_limit_dual_min', 0)
                angle_max = dual_info.get('angle_limit_dual_max', 0)
                angle_min = dual_info.get('angle_limit_dual_min', 0)
                
                has_dual = abs(thermal_max) > 1e-6 or abs(thermal_min) > 1e-6 or abs(angle_max) > 1e-6 or abs(angle_min) > 1e-6
                
                if has_dual:
                    print(f"    ⚠️  Dual Values: thermal_max={thermal_max:.6f}, thermal_min={thermal_min:.6f}")
                    print(f"                    angle_max={angle_max:.6f}, angle_min={angle_min:.6f}")
                else:
                    print(f"    ✓ Dual Values: All zero")
            else:
                print(f"    ⚠️  Dual information not available")
            print()
    
    if switched_on_lines:
        print(f"\n🟢 LINES SWITCHED ON ({len(switched_on_lines)} lines):")
        print("-" * 120)
        for branch_id in sorted(switched_on_lines):
            branch_info = switching_branches[branch_id]
            
            # Get dual info from switching result to get angle diff
            switching_duals = switching_result.get('dual_variables', {})
            switching_all_branches = switching_duals.get('all_branches', {})
            switching_dual_info = switching_all_branches.get(branch_id, None)
            
            fbus = branch_info.get('fbus')
            tbus = branch_info.get('tbus')
            flow = branch_info.get('flow', 0)
            capacity = branch_info.get('capacity', 0)
            util = (abs(flow) / capacity * 100) if capacity > 0 else 0
            
            # Get angle difference from switching scenario
            angle_diff = switching_dual_info.get('angle_diff_deg', 0) if switching_dual_info else 0
            
            print(f"  Branch {branch_id}: ({fbus}, {tbus})")
            print(f"    Switching: Flow={flow:.2f} MW, Utilization={util:.2f}%, Angle Diff={angle_diff:.4f}°")
            print(f"    Note: Was OFF in baseline, no dual values available")
            print()
    
    print("=" * 120)
    print()


# Request/Response Models
class OptimizeRequest(BaseModel):
    constraints: List[str] = []
    verbose: bool = False
    # Adjustable parameters
    angle_bound_degrees: Optional[float] = None  # Angle bound in degrees (default: 30)
    load_multiplier: Optional[float] = None  # Multiply all loads by this factor (default: 1.0)
    generator_capacity_multiplier: Optional[float] = None  # Multiply generator max capacity (default: 1.0)
    capacity_limit_multiplier: Optional[float] = None  # Multiply branch capacity limits (default: 1.0, e.g., 0.8 = 80% capacity cut)
    use_slack: bool = False  # Enable slack variables on angle/flow constraints
    slack_penalty_angle: Optional[float] = None
    slack_penalty_flow: Optional[float] = None
    force_second_cheapest: bool = False
    switch_off_lines: Optional[List[int]] = None
    slack_angle_fraction: Optional[float] = None  # Allow angle slack as fraction of angle limit (e.g., 0.001 = 0.1%)
    slack_flow_fraction: Optional[float] = None  # Allow flow slack as fraction of line limit


class OptimizeResponse(BaseModel):
    status: str
    objective: Optional[float] = None
    total_generation: Optional[float] = None
    total_load: Optional[float] = None
    total_shunt: Optional[float] = None
    total_consumption: Optional[float] = None
    power_balance_error: Optional[float] = None
    generators: Optional[dict] = None
    branches: Optional[dict] = None
    bus_angles: Optional[dict] = None
    bus_loads: Optional[dict] = None
    slack_values: Optional[dict] = None
    constraint_duals: Optional[dict] = None
    forced_generator: Optional[int] = None
    disabled_lines: Optional[List[int]] = None
    lines_on: Optional[int] = None
    lines_off: Optional[int] = None
    dual_variables: Optional[dict] = None  # Contains all dual variables and non-zero duals
    switched_off_analysis: Optional[list] = None  # Analysis of switched-off lines
    message: Optional[str] = None


# API Endpoints

@app.get("/")
async def root():
    """Root endpoint - API info"""
    return {
        "message": "OPF Visualization API",
        "version": "1.0.0",
        "endpoints": {
            "GET /api/topology": "Get network topology",
            "POST /api/optimize": "Run OPF optimization",
            "GET /api/constraints": "List available constraints"
        }
    }


@app.get("/api/topology")
async def get_topology():
    """
    Get network topology data for visualization
    
    Returns:
        Network topology with nodes and edges
    """
    try:
        topology = opf_solver.get_topology(bus_df, gen_df, branch_df)
        return topology
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/optimize")
async def optimize(request: OptimizeRequest):
    """
    Run OPF optimization with specified constraints
    
    Args:
        request: OptimizeRequest with constraints list
            Valid constraints: ['line_switching', 'angle_bound', 'capacity']
    
    Returns:
        Optimization results including cost, flows, and switching status
    """
    try:
        # Log received parameters
        print("=" * 70)
        print("🚀 Optimization Request Received:")
        print(f"  Constraints: {request.constraints}")
        print(f"  Angle Bound: {request.angle_bound_degrees}°")
        print(f"  Load Multiplier: {request.load_multiplier}x")
        print(f"  Gen Capacity Multiplier: {request.generator_capacity_multiplier}x")
        print("=" * 70)
        
        # Validate constraints
        valid_constraints = ['line_switching', 'angle_bound', 'capacity']
        for constraint in request.constraints:
            if constraint not in valid_constraints:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid constraint '{constraint}'. Valid options: {valid_constraints}"
                )
        
        # Prepare modified dataframes if parameters are provided
        modified_bus_df = bus_df.copy()
        modified_gen_df = gen_df.copy()
        
        # Apply load multiplier if provided
        if request.load_multiplier is not None:
            if request.load_multiplier < 0:
                raise HTTPException(status_code=400, detail="load_multiplier must be >= 0")
            original_load = bus_df['Pd'].sum()
            modified_bus_df['Pd'] = bus_df['Pd'] * request.load_multiplier
            new_load = modified_bus_df['Pd'].sum()
            print(f"✅ Load adjusted: {original_load:.2f} MW → {new_load:.2f} MW (x{request.load_multiplier})")
        
        # Apply generator capacity multiplier if provided
        if request.generator_capacity_multiplier is not None:
            if request.generator_capacity_multiplier < 0:
                raise HTTPException(status_code=400, detail="generator_capacity_multiplier must be >= 0")
            original_capacity = gen_df['Pmax'].sum()
            modified_gen_df['Pmax'] = gen_df['Pmax'] * request.generator_capacity_multiplier
            new_capacity = modified_gen_df['Pmax'].sum()
            print(f"✅ Gen capacity adjusted: {original_capacity:.2f} MW → {new_capacity:.2f} MW (x{request.generator_capacity_multiplier})")
        
        # Run optimization
        slack_penalty_angle = request.slack_penalty_angle if request.slack_penalty_angle is not None else 1e4
        slack_penalty_flow = request.slack_penalty_flow if request.slack_penalty_flow is not None else 1e4
        result = opf_solver.solve_dc_opf(
            bus_df=modified_bus_df,
            gen_df=modified_gen_df,
            branch_df=branch_df,
            gencost_df=gencost_df,
            constraints=request.constraints,
            verbose=request.verbose,
            angle_bound_degrees=request.angle_bound_degrees,
            capacity_limit_multiplier=request.capacity_limit_multiplier,
            use_slack=request.use_slack,
            slack_penalty_angle=slack_penalty_angle,
            slack_penalty_flow=slack_penalty_flow,
            force_second_cheapest=request.force_second_cheapest,
            disabled_lines=request.switch_off_lines,
            slack_angle_fraction=request.slack_angle_fraction,
            slack_flow_fraction=request.slack_flow_fraction
        )
        
        # Log power balance verification
        if result.get('status') == 'optimal':
            print("=" * 70)
            print("📊 Power Balance Verification:")
            print(f"  Total Generation: {result.get('total_generation', 0):.2f} MW")
            print(f"  Total Load: {result.get('total_load', 0):.2f} MW")
            print(f"  Total Shunt: {result.get('total_shunt', 0):.2f} MW")
            print(f"  Total Consumption: {result.get('total_consumption', 0):.2f} MW")
            balance_error = result.get('power_balance_error', 0)
            print(f"  Power Balance Error: {balance_error:.6f} MW")
            if abs(balance_error) > 0.01:
                print(f"  ⚠️  WARNING: Power balance mismatch detected!")
            else:
                print(f"  ✅ Power balance verified (within tolerance)")
            print("=" * 70)

        
        # Store or compare results for switching analysis
        global baseline_result
        
        # Determine load multiplier and angle bound for reporting
        load_mult = request.load_multiplier if request.load_multiplier is not None else 1.0
        angle_bound = request.angle_bound_degrees if request.angle_bound_degrees is not None else 30.0
        
        if 'line_switching' not in request.constraints:
            # This is a baseline run - store it
            baseline_result = result
        else:
            # This is a switching run - compare with baseline
            if baseline_result is not None:
                print_switching_comparison_report(
                    baseline_result, 
                    result, 
                    load_mult, 
                    angle_bound
                )
        
        return result
    
    except Exception as e:
        import traceback
        error_detail = str(e)
        error_traceback = traceback.format_exc()
        print("=" * 70)
        print("❌ Optimization Error:")
        print(error_traceback)
        print("=" * 70)
        raise HTTPException(status_code=500, detail=error_detail)


@app.get("/api/constraints")
async def get_constraints():
    """
    Get list of available constraints
    
    Returns:
        List of constraint options with descriptions
    """
    return {
        "constraints": [
            {
                "id": "line_switching",
                "name": "Line Switching",
                "description": "Allow binary line switching (on/off) to optimize power flow"
            },
            {
                "id": "angle_bound",
                "name": "Angle Bounds",
                "description": "Limit angle differences per line (adjustable, default: ±30°)"
            },
            {
                "id": "capacity",
                "name": "Capacity Constraints",
                "description": "Enforce branch capacity limits"
            }
        ],
        "note": "You can combine multiple constraints in the optimize request"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "data_loaded": True,
        "num_buses": len(bus_df),
        "num_branches": len(branch_df),
        "num_generators": len(gen_df)
    }


if __name__ == "__main__":
    import uvicorn
    print("=" * 70)
    print("OPF Visualization API Server")
    print("=" * 70)
    print(f"Data: IEEE 57-Bus System")
    print(f"  Buses: {len(bus_df)}")
    print(f"  Branches: {len(branch_df)}")
    print(f"  Generators: {len(gen_df)}")
    print(f"  Total Load: {bus_df['Pd'].sum():.2f} MW")
    print("=" * 70)
    print("Starting server at http://localhost:8000")
    print("API docs at http://localhost:8000/docs")
    print("=" * 70)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

