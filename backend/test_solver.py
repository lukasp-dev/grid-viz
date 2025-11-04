"""
Test script for OPF solver module
Tests basic OPF optimization without constraints
"""

import os
os.environ["GRB_LICENSE_FILE"] = "/Users/a/Desktop/VIP/sc-opf/API key/gurobi.lic"

import opf_solver

# Load data
bus_df, gen_df, branch_df, gencost_df = opf_solver.load_case_data('data/pglib_opf_case57_ieee.m')

print(f"Loaded: {len(bus_df)} buses, {len(branch_df)} branches, {len(gen_df)} generators")

# Test optimization
print("\nTesting basic OPF (no constraints)...")
try:
    result = opf_solver.solve_dc_opf(bus_df, gen_df, branch_df, gencost_df, constraints=[], verbose=True)
    print(f"\nResult: {result['status']}")
    if result['status'] == 'optimal':
        print(f"Cost: ${result['objective']:.2f}")
        print(f"Generation: {result['total_generation']:.2f} MW")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
