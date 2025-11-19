# Line Switching Analysis Report - English Summary

## Executive Summary

This report analyzes why transmission lines were switched off in three different load scenarios (1.12x, 1.13x, 1.14x load multiplier) for the IEEE 57-Bus system with line switching optimization enabled.

---

## Scenario 1.12 (Load Multiplier: 1.12)

### Basic Statistics
- **Total Lines**: 80
- **Lines ON**: 73
- **Lines OFF**: 7
- **Objective Cost**: $39,349.03
- **Total Generation**: 1,400.90 MW
- **Total Load**: 1,400.90 MW

### Switched-Off Lines Analysis

#### 1. Line 10: 9→12 (ID: 10)
- **Reactance**: 0.2950 pu
- **Capacity**: 98.00 MVA
- **Primary Reason**: **Congestion Relief**
- **Detailed Explanation**:
  - Found 3 alternative paths between buses 9 and 12
  - Connected line 7 (8→9) is heavily loaded at 99.8% utilization
  - Switching off relieves congestion on line 7 (8→9)
  - Reactance is higher than median, reducing losses when off
- **Conclusion**: This line is switched off to divert flow away from the highly congested line 7 (8→9), which is operating at 99.8% capacity. Alternative paths exist, making this switch effective for congestion relief.

#### 2. Line 42: 30→31 (ID: 42)
- **Reactance**: 0.4970 pu
- **Capacity**: 50.00 MVA
- **Primary Reason**: **Cost Optimization** (Loss Reduction)
- **Detailed Explanation**:
  - High reactance (0.4970 pu) - significantly above median
  - Switching off reduces system losses
- **Conclusion**: This line has very high reactance, causing significant losses. It's switched off to minimize overall system losses, which reduces generation costs.

#### 3. Line 58: 14→46 (ID: 58)
- **Reactance**: 0.0735 pu
- **Capacity**: 400.00 MVA
- **Primary Reason**: **Angle Constraint Violation**
- **Detailed Explanation**:
  - Angle difference between buses 14 and 46 is 31.0°
  - Exceeds the 30° angle bound constraint
  - Switching off avoids angle bound violation
- **Conclusion**: The voltage angle difference exceeds the safety limit. This line must be switched off to maintain system stability within angle constraints.

#### 4. Line 63: 50→51 (ID: 63)
- **Reactance**: 0.2200 pu
- **Capacity**: 113.00 MVA
- **Primary Reason**: **Angle Constraint Violation**
- **Detailed Explanation**:
  - Angle difference between buses 50 and 51 is 31.9°
  - Exceeds the 30° angle bound constraint
  - High reactance also contributes to loss reduction
- **Conclusion**: Similar to line 58, this line violates the angle constraint and is switched off for stability reasons.

#### 5. Line 65: 13→49 (ID: 65)
- **Reactance**: 0.1910 pu
- **Capacity**: 154.00 MVA
- **Primary Reason**: **Angle Constraint Violation**
- **Detailed Explanation**:
  - Angle difference between buses 13 and 49 is 31.5°
  - Exceeds the 30° angle bound constraint
- **Conclusion**: Another angle constraint violation. The line is switched off to maintain system stability.

#### 6. Line 69: 54→55 (ID: 69)
- **Reactance**: 0.2265 pu
- **Capacity**: 103.00 MVA
- **Primary Reason**: **Cost Optimization** (Loss Reduction)
- **Detailed Explanation**:
  - Reactance is higher than median
  - Switching off reduces system losses
- **Conclusion**: Switched off to reduce losses and minimize generation costs.

#### 7. Line 71: 44→45 (ID: 71)
- **Reactance**: 0.1242 pu
- **Capacity**: 212.00 MVA
- **Primary Reason**: **Angle Constraint Violation**
- **Detailed Explanation**:
  - Angle difference between buses 44 and 45 is 30.3°
  - Just exceeds the 30° angle bound constraint
- **Conclusion**: Marginal angle constraint violation. The line is switched off to maintain system stability.

### Congestion Analysis

**Congested Lines (≥95% utilization)**: 3 lines
1. **Line 6: 6→8**
   - Flow: -161.53 MW / Capacity: 167.00 MVA
   - Utilization: 96.7%
   - **Classification**: **Inherent Congestion** (Cannot be relieved by switching)

2. **Line 7: 8→9**
   - Flow: 569.13 MW / Capacity: 570.00 MVA
   - Utilization: 99.8%
   - **Classification**: **Removable Congestion** (Could be relieved by turning on line 10: 9→12)

3. **Line 37: 26→27**
   - Flow: -95.75 MW / Capacity: 97.00 MVA
   - Utilization: 98.7%
   - **Classification**: **Inherent Congestion** (Cannot be relieved by switching)

### Generator Analysis

- **Generator 0 (Bus 1)**: 100.0% utilization (245.00 MW / 245.00 MW)
- **Generator 4 (Bus 8)**: 99.7% utilization (1,155.90 MW / 1,159.00 MW)
  - ⚠️ Not at full capacity - downstream congestion may be limiting output
- Other generators: 0% utilization (not needed)

---

## Scenario 1.13 (Load Multiplier: 1.13)

### Basic Statistics
- **Total Lines**: 80
- **Lines ON**: 73
- **Lines OFF**: 7
- **Objective Cost**: $39,763.96
- **Total Generation**: 1,413.40 MW
- **Total Load**: 1,413.40 MW

### Switched-Off Lines Analysis

#### 1. Line 10: 9→12 (ID: 10)
- **Primary Reason**: **Congestion Relief**
- **Detailed Explanation**:
  - Connected lines are heavily loaded: Line 7 (8→9) at 99.9%, Line 9 (9→11) at 99.7%
  - Angle difference: 36.6° (exceeds 30° constraint)
  - Switching off relieves congestion on nearby lines
  - Found 1 alternative path between buses 9 and 12

#### 2. Line 11: 9→13 (ID: 11)
- **Primary Reason**: **Congestion Relief**
- **Detailed Explanation**:
  - Connected lines heavily loaded: Line 7 (8→9) at 99.9%, Line 9 (9→11) at 99.7%
  - Switching off relieves congestion on nearby lines
  - Found 1 alternative path between buses 9 and 13

#### 3. Line 14: 1→15 (ID: 14)
- **Primary Reason**: **Congestion Relief**
- **Detailed Explanation**:
  - Connected line 15 (1→16) is heavily loaded at 92.3%
  - Switching off relieves congestion on nearby lines

#### 4. Line 17: 3→15 (ID: 17)
- **Primary Reason**: **Cost Optimization**

#### 5. Line 18: 4→18 (ID: 18)
- **Primary Reason**: **Alternative Path Available**
- **Detailed Explanation**:
  - Parallel line 19 available
  - High reactance (0.5550 pu) - switching off reduces losses
  - Found 1 alternative path between buses 4 and 18

#### 6. Line 22: 10→12 (ID: 22)
- **Primary Reason**: **Cost Optimization**

#### 7. Line 79: 9→55 (ID: 79)
- **Primary Reason**: **Congestion Relief**
- **Detailed Explanation**:
  - Connected lines heavily loaded: Line 7 (8→9) at 99.9%, Line 9 (9→11) at 99.7%
  - Switching off relieves congestion on nearby lines

### Congestion Analysis

**Congested Lines (≥95% utilization)**: 3 lines
1. **Line 6: 6→8** - 99.9% utilization (Inherent)
2. **Line 7: 8→9** - 99.9% utilization (Removable - could use lines 10, 11, or 79)
3. **Line 9: 9→11** - 99.7% utilization (Removable - could use lines 10, 11, or 79)

---

## Scenario 1.14 (Load Multiplier: 1.14)

### Basic Statistics
- **Total Lines**: 80
- **Lines ON**: 74
- **Lines OFF**: 6
- **Objective Cost**: $40,189.18
- **Total Generation**: 1,425.91 MW
- **Total Load**: 1,425.91 MW

### Switched-Off Lines Analysis

#### 1. Line 3: 4→5 (ID: 3)
- **Primary Reason**: **Avoiding Congestion**
- **Detailed Explanation**:
  - Connected line 4 (4→6) is heavily loaded at 89.7%
  - Found 1 alternative path between buses 4 and 5
  - Switching off prevents further congestion

#### 2. Line 10: 9→12 (ID: 10)
- **Primary Reason**: **Congestion Relief**
- **Detailed Explanation**:
  - Connected lines heavily loaded: Line 7 (8→9) at 99.9%, Line 9 (9→11) at 99.6%
  - Angle difference: 38.5° (exceeds 30° constraint)
  - Switching off relieves congestion on nearby lines

#### 3. Line 11: 9→13 (ID: 11)
- **Primary Reason**: **Congestion Relief**
- **Detailed Explanation**:
  - Connected lines heavily loaded: Line 7 (8→9) at 99.9%, Line 9 (9→11) at 99.6%
  - Switching off relieves congestion on nearby lines

#### 4. Line 17: 3→15 (ID: 17)
- **Primary Reason**: **Alternative Path Available**
- **Detailed Explanation**:
  - Found 1 alternative path between buses 3 and 15

#### 5. Line 22: 10→12 (ID: 22)
- **Primary Reason**: **Cost Optimization**

#### 6. Line 79: 9→55 (ID: 79)
- **Primary Reason**: **Congestion Relief**
- **Detailed Explanation**:
  - Connected lines heavily loaded: Line 7 (8→9) at 99.9%, Line 9 (9→11) at 99.6%
  - Switching off relieves congestion on nearby lines

---

## Key Findings and Patterns

### 1. **Angle Constraint Violations**
Several lines are switched off due to voltage angle differences exceeding 30°:
- **Scenario 1.12**: Lines 58, 63, 65, 71 (4 lines)
- **Scenario 1.13**: Line 10 (angle difference: 36.6°)
- **Scenario 1.14**: Line 10 (angle difference: 38.5°)

**Explanation**: As load increases, voltage angle differences across the network increase. Lines connecting buses with large angle differences (>30°) are switched off to maintain system stability and prevent angle bound violations.

### 2. **Congestion Relief Strategy**
The most common reason for switching lines off is to relieve congestion on heavily loaded lines:

**Critical Congestion Points**:
- **Line 7 (8→9)**: Operating at 99.8-99.9% capacity across all scenarios
- **Line 9 (9→11)**: Operating at 99.6-99.7% capacity in scenarios 1.13 and 1.14
- **Line 6 (6→8)**: Operating at 96.7-99.9% capacity (inherent congestion)

**Switching Strategy**:
- Lines 10 (9→12), 11 (9→13), and 79 (9→55) are consistently switched off to divert flow away from the congested bus 9 area
- This creates alternative paths that reduce flow on the highly congested lines 7 and 9

### 3. **Loss Reduction**
High-reactance lines are switched off to reduce system losses:
- **Line 42 (30→31)**: Reactance 0.4970 pu (very high)
- **Line 18 (4→18)**: Reactance 0.5550 pu (very high)
- Other lines with reactance above median are switched off when alternative paths exist

### 4. **Inherent vs. Removable Congestion**

**Inherent Congestion** (Cannot be relieved by switching):
- Line 6 (6→8): Structural bottleneck - no switched-off lines nearby to provide relief
- Line 37 (26→27): Isolated congestion area

**Removable Congestion** (Could be relieved by switching):
- Line 7 (8→9): Could be relieved by turning on lines 10, 11, or 79
- Line 9 (9→11): Could be relieved by turning on lines 10, 11, or 79

### 5. **Generator Utilization**

**Bus 8 Generator**:
- Scenario 1.12: 99.7% utilization (1,155.90 MW / 1,159.00 MW)
- **Not at full capacity** - downstream congestion (line 7) is limiting output
- **Tracing downstream**: Line 7 (8→9) is the first congested line blocking additional output

**Analysis**: The generator at bus 8 cannot operate at full capacity because line 7 (8→9) downstream is already at 99.8% capacity. This is a **removable congestion** - turning on lines 10, 11, or 79 could divert flow and allow the generator to increase output.

---

## Manual Analysis Guide Results

### For Every Line That Was Switched Off:

#### Scenario 1.12 - Switched-Off Lines:

1. **Line 10 (9→12)**: Switched off to relieve congestion on line 7 (8→9) operating at 99.8% capacity. Alternative paths exist. **Removable congestion relief**.

2. **Line 42 (30→31)**: Switched off due to high reactance (0.4970 pu) causing significant losses. **Loss reduction**.

3. **Line 58 (14→46)**: Switched off due to angle constraint violation (31.0° > 30°). **Stability constraint**.

4. **Line 63 (50→51)**: Switched off due to angle constraint violation (31.9° > 30°). **Stability constraint**.

5. **Line 65 (13→49)**: Switched off due to angle constraint violation (31.5° > 30°). **Stability constraint**.

6. **Line 69 (54→55)**: Switched off to reduce losses (high reactance). **Loss reduction**.

7. **Line 71 (44→45)**: Switched off due to angle constraint violation (30.3° > 30°). **Stability constraint**.

#### Scenario 1.13 - Switched-Off Lines:

1. **Line 10 (9→12)**: Switched off to relieve congestion on lines 7 (8→9) at 99.9% and 9 (9→11) at 99.7%. Also violates angle constraint (36.6°). **Congestion relief + stability**.

2. **Line 11 (9→13)**: Switched off to relieve congestion on lines 7 and 9. **Congestion relief**.

3. **Line 14 (1→15)**: Switched off to relieve congestion on line 15 (1→16) at 92.3%. **Congestion relief**.

4. **Line 17 (3→15)**: Switched off for cost optimization. **Loss reduction**.

5. **Line 18 (4→18)**: Switched off - parallel line 19 available, high reactance. **Alternative path + loss reduction**.

6. **Line 22 (10→12)**: Switched off for cost optimization. **Loss reduction**.

7. **Line 79 (9→55)**: Switched off to relieve congestion on lines 7 and 9. **Congestion relief**.

#### Scenario 1.14 - Switched-Off Lines:

1. **Line 3 (4→5)**: Switched off to avoid congestion on line 4 (4→6) at 89.7%. Alternative path exists. **Congestion avoidance**.

2. **Line 10 (9→12)**: Switched off to relieve congestion on lines 7 (8→9) at 99.9% and 9 (9→11) at 99.6%. Angle constraint violation (38.5°). **Congestion relief + stability**.

3. **Line 11 (9→13)**: Switched off to relieve congestion on lines 7 and 9. **Congestion relief**.

4. **Line 17 (3→15)**: Switched off - alternative path available. **Alternative path**.

5. **Line 22 (10→12)**: Switched off for cost optimization. **Loss reduction**.

6. **Line 79 (9→55)**: Switched off to relieve congestion on lines 7 and 9. **Congestion relief**.

---

## Conclusions

### Why Lines Are Switched Off:

1. **Congestion Relief** (Most Common):
   - Lines are switched off to divert power flow away from heavily loaded lines
   - Bus 9 area is particularly congested (lines 7 and 9 operating at >99% capacity)
   - Lines 10, 11, and 79 are consistently switched off to relieve this congestion

2. **Angle Constraint Violations**:
   - As load increases, voltage angle differences increase
   - Lines connecting buses with angle differences >30° are switched off for stability
   - More angle violations occur as load multiplier increases

3. **Loss Reduction**:
   - High-reactance lines are switched off to reduce system losses
   - This reduces generation costs

4. **Alternative Paths Available**:
   - Lines are switched off when alternative paths exist that can handle the flow
   - This allows the optimizer to choose more efficient paths

### Congestion Classification:

- **Inherent Congestion**: Structural bottlenecks that cannot be relieved by switching (e.g., Line 6: 6→8)
- **Removable Congestion**: Can be relieved by turning on switched-off lines (e.g., Line 7: 8→9 can use lines 10, 11, or 79)

### Generator Capacity Limitation:

The generator at bus 8 operates at 99.7% capacity in scenario 1.12, not 100%, because:
- **Downstream congestion**: Line 7 (8→9) is the first congested line blocking additional output
- **Classification**: This is **removable congestion** - switching on lines 10, 11, or 79 could divert flow and allow the generator to reach full capacity
- **Tracing**: Power flows from bus 8 → line 7 (8→9) → bus 9 area, where congestion occurs

---

## Recommendations

1. **For Removable Congestion**: Consider turning on lines 10, 11, or 79 to relieve congestion on lines 7 and 9, allowing generators to operate at full capacity.

2. **For Angle Constraint Violations**: As load increases, more lines violate angle constraints. Consider:
   - Installing reactive power compensation
   - Adjusting generator dispatch
   - Adding new transmission lines in high-angle-difference areas

3. **For Inherent Congestion**: Line 6 (6→8) represents a structural bottleneck. Consider:
   - Upgrading line capacity
   - Adding parallel lines
   - Redistributing generation

4. **For Loss Reduction**: High-reactance lines are switched off to reduce losses. Consider:
   - Upgrading lines with very high reactance
   - Installing series compensation
   - Reconfiguring the network topology

---

*Report generated by Line Switching Analysis Tool*
*Analysis Date: 2025*

