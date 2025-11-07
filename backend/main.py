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
# Gurobi license file path - set this in your environment or update the path
# For production, use environment variable: export GRB_LICENSE_FILE=/path/to/gurobi.lic

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


# Request/Response Models
class OptimizeRequest(BaseModel):
    constraints: List[str] = []
    verbose: bool = False
    # Adjustable parameters
    angle_bound_degrees: Optional[float] = None  # Angle bound in degrees (default: 30)
    load_multiplier: Optional[float] = None  # Multiply all loads by this factor (default: 1.0)
    generator_capacity_multiplier: Optional[float] = None  # Multiply generator max capacity (default: 1.0)
    capacity_limit_multiplier: Optional[float] = None  # Multiply branch capacity limits (default: 1.0, e.g., 0.8 = 80% capacity cut)


class OptimizeResponse(BaseModel):
    status: str
    objective: Optional[float] = None
    total_generation: Optional[float] = None
    total_load: Optional[float] = None
    generators: Optional[dict] = None
    branches: Optional[dict] = None
    bus_angles: Optional[dict] = None
    lines_on: Optional[int] = None
    lines_off: Optional[int] = None
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
        result = opf_solver.solve_dc_opf(
            bus_df=modified_bus_df,
            gen_df=modified_gen_df,
            branch_df=branch_df,
            gencost_df=gencost_df,
            constraints=request.constraints,
            verbose=request.verbose,
            angle_bound_degrees=request.angle_bound_degrees,
            capacity_limit_multiplier=request.capacity_limit_multiplier
        )
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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

