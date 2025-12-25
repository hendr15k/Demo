# Bio-Programs: Struggle for Cycles

A browser-based simulation of self-replicating programs that compete for memory and CPU cycles. Programs evolve through random bit-flip mutations during copying.

[Play Demo](index.html) (Open this file in your browser)

## Overview

The simulation consists of a Virtual Machine (VM) with a custom Instruction Set Architecture (ISA). Programs (organisms) reside in a shared memory space (4096 bytes).

*   **Memory**: Linear array of 32-bit integers. Visualized as a 64x64 grid.
*   **Processes**: Independent execution threads (programs). Each has an Instruction Pointer (IP) and 4 Registers.
*   **Competition**: Processes compete for memory space. Overwriting another program's memory kills or corrupts it.
*   **Evolution**: When a program writes to memory, there is a small chance (Mutation Rate) of a bit-flip. This changes instructions, potentially creating new behaviors.

## Features

*   **Multiple Species**: Choose from different starting organisms with varying strategies:
    *   *Basic Replicator*: A simple, unrolled loop that copies itself efficiently.
    *   *Smart Loop*: A compact replicator using a self-resetting loop. It is robust and can carry payloads.
    *   *Killer (Predator)*: Uses the Smart Loop engine but carries a "venomous" payload that writes `DIE` instructions to random memory locations before replicating.
*   **Visual Memory**: See the memory layout in real-time. Colors represent different lineages.
*   **Inspection**: Click on any pixel in the memory grid to inspect the instruction at that address.
*   **Stats**: Track active processes, total cycles, maximum generation reached, and total mutations.
*   **Controls**: Adjustable speed, mutation rate, pause/resume, and reset.

## Instruction Set Architecture (ISA)

Each instruction is a 32-bit word containing:
*   **Opcode** (4 bits): The operation to perform.
*   **ModeA** (2 bits), **ValA** (12 bits): First operand.
*   **ModeB** (2 bits), **ValB** (12 bits): Second operand.

### Addressing Modes
*   `0` **IMMEDIATE**: The value `Val`.
*   `1` **RELATIVE**: Memory at `IP + Val`.
*   `2` **REGISTER**: Register `Reg[Val % 4]`.
*   `3` **REG_INDIRECT**: Memory at absolute address stored in `Reg[Val % 4]`.

### Opcodes
| Opcode | Mnemonic | Description |
| :--- | :--- | :--- |
| 0 | `NOP` | No Operation. |
| 1 | `MOV A, B` | Copy value A to destination B. |
| 2 | `ADD A, B` | Add A to destination B. |
| 3 | `SUB A, B` | Subtract A from destination B. |
| 4 | `JMP A` | Jump to address A (relative). |
| 5 | `JZ A, B` | Jump to A if B is Zero. |
| 6 | `JNZ A, B` | Jump to A if B is Not Zero. |
| 7 | `SPWN A` | Spawn a new process at address A. |
| 8 | `SEQ A, B` | Skip next instruction if A == B. |
| 9 | `SNE A, B` | Skip next instruction if A != B. |
| 10 | `RAND B` | Store a random value (0-4095) in B. |
| 15 | `DIE` | Terminate the current process. |

## How to Run

1.  Clone the repository.
2.  Open `index.html` in a modern web browser.
3.  Select a starting species (e.g., "Smart Loop").
4.  Click "Start" to begin the simulation.

## Controls

*   **Start**: Begins the simulation loop.
*   **Pause**: Stops the simulation.
*   **Reset**: Clears memory and restarts with a fresh instance of the selected species.
*   **Species Select**: Choose the organism to inject on reset.
*   **Speed**: Adjusts the number of VM cycles per frame.
*   **Mutation**: Adjusts the bit-flip probability (0% to 10%).
*   **Canvas Click**: Click on the grid to see the instruction details in the info box below.

## Development

The core logic is in `script.js`. It is designed to work in both the browser and Node.js (for testing).

To run tests:
```bash
node test_vm.js
node test_rand.js
```
