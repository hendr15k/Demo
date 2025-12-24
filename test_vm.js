
const { VM, OPCODES, Instruction, MODES } = require('./script.js');

const vm = new VM();
console.log("VM initialized");

// Add a simple program: MOV #123, %0
const code = Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 123, MODES.REGISTER, 0);
vm.memory[0] = code;
const p = vm.addProcess(0);

vm.step();

if (p.registers[0] === 123) {
    console.log("Test Passed: MOV #123, %0 worked.");
} else {
    console.error("Test Failed: MOV #123, %0 failed. Got " + p.registers[0]);
    process.exit(1);
}
