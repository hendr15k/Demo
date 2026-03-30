const assert = require('assert');
const { VM, getSpeciesProgram, MEMORY_SIZE, OPCODES } = require('./script.js');

function testBomber() {
    console.log("Testing Bomber species...");
    // Create VM with 0 mutation rate to ensure determinism
    const vm = new VM(0);
    const prog = getSpeciesProgram("Bomber");
    const startAddr = 0;

    // Load program
    for (let i = 0; i < prog.length; i++) {
        vm.memory[startAddr + i] = prog[i];
    }
    const p = vm.addProcess(startAddr);

    // Run until it spawns (or crashes)
    let maxSteps = 5000;
    let initialProcessCount = vm.processes.length;

    while (maxSteps > 0 && vm.processes.length === initialProcessCount && vm.processes[0].alive) {
        vm.step();
        maxSteps--;
    }

    assert(vm.processes.length > initialProcessCount, "Bomber failed to spawn a child process.");

    // Check if it dropped DIE instructions
    let dieCount = 0;
    for (let i = prog.length; i < MEMORY_SIZE; i++) {
        const op = (vm.memory[i] >>> 28) & 0xF;
        if (op === OPCODES.DIE) {
            dieCount++;
        }
    }
    assert(dieCount > 0, "Bomber failed to drop any DIE instructions.");
    console.log(`Bomber dropped ${dieCount} DIE instructions successfully.`);
    console.log("Bomber species test passed.");
}

function testTitan() {
    console.log("Testing Titan species...");
    const vm = new VM(0);
    const prog = getSpeciesProgram("Titan");
    const startAddr = 0;

    for (let i = 0; i < prog.length; i++) {
        vm.memory[startAddr + i] = prog[i];
    }
    const p = vm.addProcess(startAddr);

    // Verify NOP padding at start and end
    assert((vm.memory[0] >>> 28 & 0xF) === OPCODES.NOP, "Titan missing front NOP armor.");
    assert((vm.memory[prog.length - 1] >>> 28 & 0xF) === OPCODES.NOP, "Titan missing back NOP armor.");

    let maxSteps = 1000;
    let initialProcessCount = vm.processes.length;

    while (maxSteps > 0 && vm.processes.length === initialProcessCount && vm.processes[0].alive) {
        vm.step();
        maxSteps--;
    }

    assert(vm.processes.length > initialProcessCount, "Titan failed to spawn a child process.");

    // Check if the child has the armor
    // Child IP points to the start of the program, which is the front armor (NOP)
    const childIP = vm.processes[1].ip;
    // However, basic replicator logic does not start execution at offset 0 of the copied block immediately.
    // It spawns the child process at 'Target'. Target = Start + Offset - 13.
    // Let's just check the memory around the spawn point
    // The front armor should be at offset 128
    const expectedChildStart = 128;
    assert((vm.memory[expectedChildStart] >>> 28 & 0xF) === OPCODES.NOP, "Titan child missing front NOP armor at memory location.");

    console.log("Titan species test passed.");
}

try {
    testBomber();
    testTitan();
    console.log("All new species tests passed successfully!");
} catch (e) {
    console.error("Test failed:", e.message);
    process.exit(1);
}
