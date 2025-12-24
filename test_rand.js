
const { VM, OPCODES, Instruction, MODES, Process } = require('./script.js');

const vm = new VM();
console.log("VM initialized for RAND test");

// Create instruction: RAND (10), ModeA: 0, ValA: 0, ModeB: REGISTER (2), ValB: 0
// Stores random number in Register 0
const code = Instruction.encode(OPCODES.RAND, 0, 0, MODES.REGISTER, 0);
vm.memory[0] = code;
const p = vm.addProcess(0);

// Should be 0 initially
if (p.registers[0] !== 0) {
    console.error("Initial register not 0");
    process.exit(1);
}

// Step
vm.step();

// Check if changed
console.log(`Register 0 value after RAND: ${p.registers[0]}`);
if (p.registers[0] >= 0 && p.registers[0] < 4096) {
    console.log("Test Passed: RAND value within range.");
} else {
    console.error("Test Failed: RAND value out of range or not set.");
    process.exit(1);
}

// Test Generation tracking
const p2 = new Process(0, p);
if (p2.gen === p.gen + 1) {
    console.log(`Test Passed: Generation incremented (Parent: ${p.gen}, Child: ${p2.gen})`);
} else {
    console.error(`Test Failed: Generation mismatch. Parent: ${p.gen}, Child: ${p2.gen}`);
    process.exit(1);
}
