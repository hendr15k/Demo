const { VM, Instruction, OPCODES, MODES, getSpeciesProgram } = require('./script.js');

function testSpecies() {
    console.log("Testing new species...");
    const speciesList = ['Hunter', 'Parasite', 'Bomber'];

    for (let name of speciesList) {
        console.log(`Testing ${name}...`);
        const program = getSpeciesProgram(name);

        if (!program || program.length === 0) {
            console.error(`FAILED: ${name} program is empty.`);
            process.exit(1);
        }

        const vm = new VM(0); // 0 mutation rate for deterministic test

        // Load into memory
        for(let i=0; i<program.length; i++) {
            vm.memory[i] = program[i];
            vm.memoryMap[i] = "color";
        }
        vm.addProcess(0); // Boot at 0

        // Step it a few times to ensure it doesn't immediately crash or throw errors
        try {
            for(let i=0; i<50; i++) {
                vm.step();
            }
            console.log(`SUCCESS: ${name} ran 50 steps without crashing.`);
        } catch (e) {
            console.error(`FAILED: ${name} crashed during execution: ${e}`);
            process.exit(1);
        }
    }
    console.log("All new species tests passed.");
}

testSpecies();
