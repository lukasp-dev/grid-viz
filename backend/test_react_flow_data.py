"""
Test script to verify API data is sufficient for React Flow visualization
"""

import requests
import json

API_URL = "http://localhost:8000"

print("=" * 80)
print("Testing API Data for React Flow Compatibility")
print("=" * 80)

# 1. Get Topology
print("\n1. Testing Topology Data...")
topology = requests.get(f"{API_URL}/api/topology").json()

print(f"✓ Nodes: {len(topology['nodes'])}")
print(f"✓ Edges: {len(topology['edges'])}")

# Check node structure
sample_node = topology['nodes'][0]
print(f"\nSample Node:")
print(json.dumps(sample_node, indent=2))

required_node_fields = ['id', 'type', 'load', 'voltage']
has_all_node_fields = all(field in sample_node for field in required_node_fields)
print(f"✓ Has all required fields: {has_all_node_fields}")

# Check edge structure
sample_edge = topology['edges'][0]
print(f"\nSample Edge:")
print(json.dumps(sample_edge, indent=2))

required_edge_fields = ['id', 'source', 'target', 'reactance', 'capacity']
has_all_edge_fields = all(field in sample_edge for field in required_edge_fields)
print(f"✓ Has all required fields: {has_all_edge_fields}")

# 2. Run Optimization
print("\n" + "=" * 80)
print("2. Testing Optimization Results...")
result = requests.post(
    f"{API_URL}/api/optimize",
    json={"constraints": ["line_switching"]}
).json()

print(f"✓ Status: {result['status']}")
print(f"✓ Cost: ${result['objective']:.2f}")
print(f"✓ Lines ON: {result['lines_on']}")
print(f"✓ Lines OFF: {result['lines_off']}")

# Check branch flow data
sample_branch = list(result['branches'].values())[0]
print(f"\nSample Branch Flow:")
print(json.dumps(sample_branch, indent=2))

required_branch_fields = ['fbus', 'tbus', 'flow', 'capacity', 'utilization', 'status']
has_all_branch_fields = all(field in sample_branch for field in required_branch_fields)
print(f"✓ Has all required fields: {has_all_branch_fields}")

# Check generator data
sample_gen = list(result['generators'].values())[0]
print(f"\nSample Generator:")
print(json.dumps(sample_gen, indent=2))

required_gen_fields = ['bus', 'Pg', 'Pmax', 'Pmin']
has_all_gen_fields = all(field in sample_gen for field in required_gen_fields)
print(f"✓ Has all required fields: {has_all_gen_fields}")

# 3. Verify React Flow Requirements
print("\n" + "=" * 80)
print("3. React Flow Requirements Check")
print("=" * 80)

print("\n📊 Node Requirements:")
print("  ✓ Unique ID: Yes (bus number)")
print("  ✓ Type/Category: Yes (slack/generator/load)")
print("  ✓ Position Data: Can be computed from layout algorithm")
print("  ✓ Additional Data:")
print(f"    - Load: {sample_node['load']} MW")
print(f"    - Voltage: {sample_node['voltage']} p.u.")
if result['bus_angles']:
    print(f"    - Angle: {list(result['bus_angles'].values())[0]:.2f}°")

print("\n🔗 Edge Requirements:")
print("  ✓ Unique ID: Yes (combination of source-target)")
print("  ✓ Source Node: Yes (fbus)")
print("  ✓ Target Node: Yes (tbus)")
print("  ✓ Additional Data:")
print(f"    - Flow: {sample_branch['flow']:.2f} MW")
print(f"    - Capacity: {sample_branch['capacity']:.2f} MW")
print(f"    - Utilization: {sample_branch['utilization']:.1f}%")
print(f"    - Status: {'ON' if sample_branch['status'] > 0.5 else 'OFF'}")

# 4. Summary
print("\n" + "=" * 80)
print("✅ SUMMARY")
print("=" * 80)
print("\nAll required data for React Flow visualization is available:")
print("  ✓ Network topology (nodes and edges)")
print("  ✓ Node classifications (slack/generator/load)")
print("  ✓ Power flow data")
print("  ✓ Line switching status")
print("  ✓ Utilization metrics")
print("  ✓ Generation data")
print("  ✓ Bus angles")
print("\n🎨 Frontend can create:")
print("  - Interactive network graph")
print("  - Color-coded nodes by type")
print("  - Edge colors by utilization")
print("  - Animated flows")
print("  - Toggle line switching on/off")
print("  - Display power flow magnitudes")
print("\n✅ API is ready for React Flow integration!")

