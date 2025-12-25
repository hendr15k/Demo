// Bio-Programs Simulation

// --- Configuration ---
const MEMORY_SIZE = 4096;
const MAX_PROCESSES = 1000;
let mutationRate = 0.001;
const MAX_CYCLES = 1000000;

// --- Instruction Set Architecture (ISA) ---
const OPCODES = {
    NOP: 0,
    MOV: 1,
    ADD: 2,
    SUB: 3,
    JMP: 4,
    JZ:  5,
    JNZ: 6,
    SPWN: 7,
    SEQ: 8,
    SNE: 9,
    RAND: 10,
    DIE: 15
};

const MODES = {
    IMMEDIATE: 0,
    RELATIVE: 1,
    REGISTER: 2,
    REG_INDIRECT: 3
};

const FIELD_MASK = 0xFFF;

class Instruction {
    constructor(opcode, modeA, valA, modeB, valB) {
        this.opcode = opcode;
        this.modeA = modeA;
        this.valA = valA;
        this.modeB = modeB;
        this.valB = valB;
    }

    static encode(op, modeA, valA, modeB, valB) {
        let word = 0;
        word |= (op & 0xF) << 28;
        word |= (modeA & 0x3) << 26;
        word |= (valA & FIELD_MASK) << 14;
        word |= (modeB & 0x3) << 12;
        word |= (valB & FIELD_MASK);
        return word;
    }

    static decode(word) {
        const op = (word >>> 28) & 0xF;
        const modeA = (word >>> 26) & 0x3;
        let valA = (word >>> 14) & FIELD_MASK;
        const modeB = (word >>> 12) & 0x3;
        let valB = word & FIELD_MASK;

        if (valA & 0x800) valA |= 0xFFFFF000;
        if (valB & 0x800) valB |= 0xFFFFF000;

        return new Instruction(op, modeA, valA, modeB, valB);
    }
}

// --- VM Classes ---

class Process {
    constructor(ip, parent = null) {
        this.ip = ip;
        this.registers = new Int32Array(4).fill(0);
        this.alive = true;
        this.age = 0;
        this.gen = parent ? parent.gen + 1 : 0;
        this.color = parent ? parent.color : `hsl(${Math.random() * 360}, 100%, 50%)`;
    }
}

class VM {
    constructor() {
        this.memory = new Int32Array(MEMORY_SIZE).fill(0);
        this.memoryMap = new Array(MEMORY_SIZE).fill(null);
        this.processes = [];
        this.cycles = 0;
        this.totalMutations = 0;
        this.populationHistory = [];
    }

    reset() {
        this.memory.fill(0);
        this.memoryMap.fill(null);
        this.processes = [];
        this.cycles = 0;
        this.totalMutations = 0;
        this.populationHistory = [];
    }

    addProcess(ip) {
        if (this.processes.length < MAX_PROCESSES) {
            const p = new Process(ip % MEMORY_SIZE);
            this.processes.push(p);
            return p;
        }
        return null;
    }

    wrap(addr) {
        return ((addr % MEMORY_SIZE) + MEMORY_SIZE) % MEMORY_SIZE;
    }

    getVal(p, mode, val) {
        switch (mode) {
            case MODES.IMMEDIATE: return val;
            case MODES.RELATIVE: return this.memory[this.wrap(p.ip + val)];
            case MODES.REGISTER: return p.registers[Math.abs(val) % 4];
            case MODES.REG_INDIRECT: return this.memory[this.wrap(p.registers[Math.abs(val) % 4])];
            default: return 0;
        }
    }

    getAddr(p, mode, val) {
        switch (mode) {
            case MODES.IMMEDIATE: return -1;
            case MODES.RELATIVE: return this.wrap(p.ip + val);
            case MODES.REGISTER: return -2;
            case MODES.REG_INDIRECT: return this.wrap(p.registers[Math.abs(val) % 4]);
            default: return -1;
        }
    }

    writeMem(addr, value, ownerProcess) {
        const target = this.wrap(addr);

        let finalValue = value;
        if (Math.random() < mutationRate) {
             const bit = Math.floor(Math.random() * 32);
             finalValue ^= (1 << bit);
             this.totalMutations++;
        }

        this.memory[target] = finalValue;
        this.memoryMap[target] = ownerProcess.color;
    }

    step() {
        this.processes = this.processes.filter(p => p.alive);

        if (this.processes.length === 0) return;

        for (let i = 0; i < this.processes.length; i++) {
            const p = this.processes[i];

            const instrWord = this.memory[p.ip];
            const instr = Instruction.decode(instrWord);

            let newIP = p.ip + 1;

            try {
                switch (instr.opcode) {
                    case OPCODES.NOP:
                        break;
                    case OPCODES.MOV: {
                        const valA = this.getVal(p, instr.modeA, instr.valA);
                        if (instr.modeB === MODES.REGISTER) {
                             p.registers[Math.abs(instr.valB) % 4] = valA;
                        } else {
                            const addrB = this.getAddr(p, instr.modeB, instr.valB);
                            if (addrB >= 0) {
                                this.writeMem(addrB, valA, p);
                            }
                        }
                        break;
                    }
                    case OPCODES.ADD: {
                        const valA = this.getVal(p, instr.modeA, instr.valA);
                        if (instr.modeB === MODES.REGISTER) {
                            p.registers[Math.abs(instr.valB) % 4] += valA;
                        } else {
                            const addrB = this.getAddr(p, instr.modeB, instr.valB);
                            if (addrB >= 0) {
                                const current = this.memory[addrB];
                                this.writeMem(addrB, current + valA, p);
                            }
                        }
                        break;
                    }
                    case OPCODES.SUB: {
                         const valA = this.getVal(p, instr.modeA, instr.valA);
                        if (instr.modeB === MODES.REGISTER) {
                            p.registers[Math.abs(instr.valB) % 4] -= valA;
                        } else {
                            const addrB = this.getAddr(p, instr.modeB, instr.valB);
                            if (addrB >= 0) {
                                const current = this.memory[addrB];
                                this.writeMem(addrB, current - valA, p);
                            }
                        }
                        break;
                    }
                    case OPCODES.JMP: {
                        const target = this.getAddr(p, instr.modeA, instr.valA);
                        if (target >= 0) {
                            newIP = target;
                        }
                        break;
                    }
                    case OPCODES.JZ: {
                        const valB = this.getVal(p, instr.modeB, instr.valB);
                        if (valB === 0) {
                            const target = this.getAddr(p, instr.modeA, instr.valA);
                             if (target >= 0) {
                                newIP = target;
                            }
                        }
                        break;
                    }
                    case OPCODES.JNZ: {
                        const valB = this.getVal(p, instr.modeB, instr.valB);
                        if (valB !== 0) {
                            const target = this.getAddr(p, instr.modeA, instr.valA);
                             if (target >= 0) {
                                newIP = target;
                            }
                        }
                        break;
                    }
                    case OPCODES.SPWN: {
                         const target = this.getAddr(p, instr.modeA, instr.valA);
                         if (target >= 0) {
                             if (this.processes.length < MAX_PROCESSES) {
                                 const newP = new Process(target, p);
                                 this.processes.push(newP);
                             }
                         }
                         break;
                    }
                    case OPCODES.SEQ: {
                        const valA = this.getVal(p, instr.modeA, instr.valA);
                        const valB = this.getVal(p, instr.modeB, instr.valB);
                        if (valA === valB) {
                            newIP++; // Skip next
                        }
                        break;
                    }
                    case OPCODES.SNE: {
                        const valA = this.getVal(p, instr.modeA, instr.valA);
                        const valB = this.getVal(p, instr.modeB, instr.valB);
                        if (valA !== valB) {
                            newIP++; // Skip next
                        }
                        break;
                    }
                    case OPCODES.RAND: {
                        const val = Math.floor(Math.random() * MEMORY_SIZE);
                        if (instr.modeB === MODES.REGISTER) {
                            p.registers[Math.abs(instr.valB) % 4] = val;
                        } else {
                            const addrB = this.getAddr(p, instr.modeB, instr.valB);
                            if (addrB >= 0) {
                                this.writeMem(addrB, val, p);
                            }
                        }
                        break;
                    }
                    case OPCODES.DIE:
                        p.alive = false;
                        break;
                }
            } catch (e) {
                console.error("Exec error", e);
                p.alive = false;
            }

            p.ip = this.wrap(newIP);
            p.age++;
        }

        this.cycles++;
    }
}

// --- Species Generation ---

function getSpeciesProgram(name) {
    const offset = 128; // Standard distance for children
    const program = [];

    // Header logic
    let header = [];
    if (name === "Killer") {
        // Shoots random zeros into memory before replicating
        for(let k=0; k<5; k++) {
            header.push(Instruction.encode(OPCODES.RAND, 0, 0, MODES.REGISTER, 0));
            header.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 15, MODES.REG_INDIRECT, 0));
        }
    }

    if (name === "Basic") {
        // Basic Replicator: Separated ADDs, requires Constant for High Bits.
        // Structure:
        // [Template] (Data, Index 0)
        // [Constant] (Data, Index 1, Value 1<<14)
        // [Boot] (Init Regs, Index 2..5)
        // [Loop] (Index 6..12)
        // [Spawn] (Index 13..14)

        const totalSize = 15;

        // Loop is at Index 6. Worker is at Index 6+1 = 7.
        // Template is at Index 0.
        // SrcRel = 0 - 7 = -7.
        // DstRel = Offset - 7.
        const workerIndex = 7;
        const srcRel = -workerIndex;
        const dstRel = offset - workerIndex;

        // 0: Template
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, srcRel, MODES.RELATIVE, dstRel));
        // 1: Constant (1<<14)
        program.push(1<<14);

        // 2: MOV #0, %0 (Counter)
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 0, MODES.REGISTER, 0));
        // 3: MOV #Size, %1 (Limit)
        program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, totalSize, MODES.REGISTER, 1));
        // 4: MOV $Template, %2 (Load Template from Index 0. IP=4. 0-4 = -4)
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -4, MODES.REGISTER, 2));
        // 5: MOV $Constant, %3 (Load Constant from Index 1. IP=5. 1-5 = -4)
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -4, MODES.REGISTER, 3));

        // Loop Start (Index 6)
        // 6: MOV %2, $Worker (Reset Worker at Index 7. Rel=1)
        program.push(Instruction.encode(OPCODES.MOV, MODES.REGISTER, 2, MODES.RELATIVE, 1));
        // 7: Worker (Placeholder)
        program.push(Instruction.encode(OPCODES.NOP, 0, 0, 0, 0));
        // 8: ADD #1, %2 (Inc Dst/ValB)
        program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 2));
        // 9: ADD %3, %2 (Inc Src/ValA using Register 3)
        program.push(Instruction.encode(OPCODES.ADD, MODES.REGISTER, 3, MODES.REGISTER, 2));
        // 10: ADD #1, %0 (Inc Counter)
        program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 0));
        // 11: SEQ %0, %1 (If Counter == Limit, Skip Jump)
        program.push(Instruction.encode(OPCODES.SEQ, MODES.REGISTER, 0, MODES.REGISTER, 1));
        // 12: JMP Start (Jump to 6. IP=12. Target=6. Offset = -6)
        program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, -6, 0, 0));

        // Spawn
        // 13: SPWN Rel(Offset - Size + ...)
        // Target = Start + Offset.
        // Current IP = Start + 13.
        // Rel = (Start + Offset) - (Start + 13) = Offset - 13.
        program.push(Instruction.encode(OPCODES.SPWN, MODES.RELATIVE, offset - 13, 0, 0));
        // 14: DIE
        program.push(Instruction.encode(OPCODES.DIE, 0, 0, 0, 0));

        return program;
    }

    // Default: SmartLoop (used for SmartLoop and Killer base)
    // Structure:
    // [Header]
    // [Template Data] (Never executed, Index 0)
    // [Constant Data] (16385, Index 1)
    // [Boot] (Init registers, Index 2, 3, 4, 5)
    // [Loop] (Copy -> Increment -> Check -> Loop)
    // [Spawn]

    // Offsets
    const headerSize = header.length;
    const templateSize = 1;
    const constantSize = 1; // New
    const bootSize = 4; // Was 3. Now 4 instructions (Init i, Limit, Template, Constant)
    const loopBodySize = 7;
    const spawnSize = 2; // SPWN, DIE

    const totalSize = headerSize + templateSize + constantSize + bootSize + loopBodySize + spawnSize;

    // indices relative to start of SmartLoop part
    // Template: 0
    // Constant: 1
    // Boot: 2..5
    // Loop: 6..12

    // Worker Index Calculation:
    // Loop starts at 6.
    // Loop body: SNE, JMP, MOV(Reset), WORKER, ADD, ADD, JMP.
    // Worker is at index 3 of Loop Body.
    // So Global Worker Index = 6 + 3 = 9.

    // Template Instruction: MOV $(Src), $(Dst)
    // SrcRel = 0 - WorkerIndex = -WorkerIndex.
    // DstRel = Offset - WorkerIndex.

    const workerIndex = headerSize + 9;
    const srcRel = -workerIndex;
    const dstRel = offset - workerIndex;

    const templateInstr = Instruction.encode(OPCODES.MOV, MODES.RELATIVE, srcRel, MODES.RELATIVE, dstRel);
    const constantVal = 16385; // 1<<14 | 1

    // Add Header
    program.push(...header);

    // Add Template (Data)
    program.push(templateInstr);

    // Add Constant (Data)
    program.push(constantVal);

    // Boot
    // 0: MOV #0, %0 (i)
    program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, 0, MODES.REGISTER, 0));
    // 1: MOV #Size, %1 (Limit)
    program.push(Instruction.encode(OPCODES.MOV, MODES.IMMEDIATE, totalSize, MODES.REGISTER, 1));
    // 2: MOV $Template, %2 (Load Template from Index 0)
    // Boot starts at Index 2 relative to SmartLoop.
    // Current IP (for this instr) is Index 4 (2+2).
    // Template is at Index 0.
    // Rel Offset = 0 - 4 = -4.
    program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -4, MODES.REGISTER, 2));
    // 3: MOV $Constant, %3 (Load Constant from Index 1)
    // Current IP is Index 5.
    // Constant is at Index 1.
    // Rel Offset = 1 - 5 = -4.
    program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, -4, MODES.REGISTER, 3));

    // Loop
    // 0: SNE %0, %1 (Check done: if i != limit, skip jump to spawn)
    program.push(Instruction.encode(OPCODES.SNE, MODES.REGISTER, 0, MODES.REGISTER, 1));
    // 1: JMP Spawn (Skip 5 instructions: MOV, WORK, ADD, ADD, JMP) -> Jump +6
    program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, 6, 0, 0));

    // 2: MOV %2, $1 (Reset Worker. Worker is at +1)
    program.push(Instruction.encode(OPCODES.MOV, MODES.REGISTER, 2, MODES.RELATIVE, 1));

    // 3: Worker (Placeholder)
    program.push(Instruction.encode(OPCODES.NOP, 0, 0, 0, 0));

    // 4: ADD %3, %2 (Inc Template Reg using Constant in %3)
    program.push(Instruction.encode(OPCODES.ADD, MODES.REGISTER, 3, MODES.REGISTER, 2));

    // 5: ADD #1, %0 (Inc Counter)
    program.push(Instruction.encode(OPCODES.ADD, MODES.IMMEDIATE, 1, MODES.REGISTER, 0));

    // 6: JMP -6 (Back to SNE)
    program.push(Instruction.encode(OPCODES.JMP, MODES.RELATIVE, -6, 0, 0));

    // Spawn
    // SPWN (Offset). Relative to *this* instruction.
    // We want to spawn at `Start + Offset`.
    // This instruction index = TotalSize - 2.
    // Relative = `(Start + Offset) - (Start + TotalSize - 2)` = `Offset - TotalSize + 2`.
    program.push(Instruction.encode(OPCODES.SPWN, MODES.RELATIVE, offset - totalSize + 2, 0, 0));
    program.push(Instruction.encode(OPCODES.DIE, 0, 0, 0, 0));

    return program;
}

// --- Visualization & UI ---

let vm;
let animationId;
let isRunning = false;
let speed = 50;

function init(speciesName = "Basic") {
    vm = new VM();

    const program = getSpeciesProgram(speciesName);
    const startAddr = Math.floor(MEMORY_SIZE / 2);

    // Clear area
    for(let i=0; i<program.length + 50; i++) {
        vm.memory[startAddr+i] = 0;
        vm.memoryMap[startAddr+i] = null;
    }

    for(let i=0; i<program.length; i++) {
        vm.memory[startAddr + i] = program[i];
        vm.memoryMap[startAddr + i] = 'white';
    }

    vm.addProcess(startAddr);

    draw();
    updateStats();
    drawPopulationGraph();
}

function initRandomSoup() {
    vm = new VM();

    // Fill memory with random instructions
    for(let i=0; i<MEMORY_SIZE; i++) {
        // Random 32-bit integer
        vm.memory[i] = Math.floor(Math.random() * 0xFFFFFFFF);
    }

    // Create random processes
    for(let i=0; i<50; i++) {
        const ip = Math.floor(Math.random() * MEMORY_SIZE);
        vm.addProcess(ip);
    }

    draw();
    updateStats();
    drawPopulationGraph();
}

function loop() {
    if (!isRunning) return;

    // Run 'speed' cycles per frame
    for(let k=0; k<speed; k++) {
        vm.step();
    }

    draw();
    updateStats();
    drawPopulationGraph();
    animationId = requestAnimationFrame(loop);
}

function drawPopulationGraph() {
    const canvas = document.getElementById('populationGraph');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Update history
    vm.populationHistory.push(vm.processes.length);
    if (vm.populationHistory.length > width) {
        vm.populationHistory.shift();
    }

    // Draw
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;

    const maxPop = Math.max(MAX_PROCESSES, ...vm.populationHistory);

    for (let i = 0; i < vm.populationHistory.length; i++) {
        const x = i;
        const pop = vm.populationHistory[i];
        const y = height - (pop / maxPop * height);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw current value text
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`Pop: ${vm.processes.length}`, width - 60, 20);
}

function draw() {
    const canvas = document.getElementById('memoryCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 4096 cells.
    // Grid size: 64x64.
    const cols = 64;
    const rows = 64;
    const cellW = width / cols;
    const cellH = height / rows;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < MEMORY_SIZE; i++) {
        const x = (i % cols) * cellW;
        const y = Math.floor(i / cols) * cellH;

        if (vm.memoryMap[i]) {
            ctx.fillStyle = vm.memoryMap[i];
            ctx.fillRect(x, y, cellW, cellH);
        } else if (vm.memory[i] !== 0) {
            ctx.fillStyle = '#333'; // Dead data
            ctx.fillRect(x, y, cellW, cellH);
        }
    }

    // Draw IPs
    for (let p of vm.processes) {
        const i = p.ip;
        const x = (i % cols) * cellW;
        const y = Math.floor(i / cols) * cellH;

        ctx.fillStyle = '#fff';
        ctx.fillRect(x+1, y+1, cellW-2, cellH-2);
    }
}

function updateStats() {
    const stats = document.getElementById('stats');
    if(stats) {
        let maxGen = 0;
        for (const p of vm.processes) {
            if (p.gen > maxGen) maxGen = p.gen;
        }
        stats.innerText = `Processes: ${vm.processes.length} | Cycles: ${vm.cycles} | Max Gen: ${maxGen} | Mutations: ${vm.totalMutations}`;
    }
}

// UI Handlers
if (typeof document !== 'undefined') {
    document.getElementById('startBtn').addEventListener('click', () => {
        if (!isRunning) {
            isRunning = true;
            loop();
        }
    });

    document.getElementById('pauseBtn').addEventListener('click', () => {
        isRunning = false;
        cancelAnimationFrame(animationId);
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        isRunning = false;
        cancelAnimationFrame(animationId);
        const species = document.getElementById('speciesSelect').value;
        init(species);
    });

    document.getElementById('randomSoupBtn').addEventListener('click', () => {
        isRunning = false;
        cancelAnimationFrame(animationId);
        initRandomSoup();
    });

    document.getElementById('speedRange').addEventListener('input', (e) => {
        speed = parseInt(e.target.value);
    });

    document.getElementById('mutationRange').addEventListener('input', (e) => {
        // Range 0-100 maps to 0.0 - 0.1 (0% to 10%)
        mutationRate = parseInt(e.target.value) / 1000;
    });

    document.getElementById('memoryCanvas').addEventListener('click', (e) => {
        const canvas = e.target;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const cols = 64;
        const rows = 64;
        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;

        const col = Math.floor(x / cellW);
        const row = Math.floor(y / cellH);
        const idx = row * cols + col;

        if (idx >= 0 && idx < MEMORY_SIZE) {
            const word = vm.memory[idx];
            const instr = Instruction.decode(word);

            const opNames = Object.keys(OPCODES).find(key => OPCODES[key] === instr.opcode) || "UNKNOWN";

            const info = document.getElementById('info');
            info.innerHTML = `
                <p>Addr: ${idx}</p>
                <p>Op: ${opNames} (${instr.opcode})</p>
                <p>ModeA: ${instr.modeA}, ValA: ${instr.valA} (${instr.valA >= 2048 ? instr.valA - 4096 : instr.valA})</p>
                <p>ModeB: ${instr.modeB}, ValB: ${instr.valB} (${instr.valB >= 2048 ? instr.valB - 4096 : instr.valB})</p>
                <p>Raw: ${word.toString(16)}</p>
                <p>Owner Color: <span style="display:inline-block;width:10px;height:10px;background-color:${vm.memoryMap[idx] || 'black'}"></span></p>
            `;
        }
    });

    // Start
    init("Basic");
}

// Export for node testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MEMORY_SIZE, OPCODES, MODES, Instruction, VM, Process, getSpeciesProgram };
}
