// Bio-Programs Simulation

// --- Configuration ---
const MEMORY_SIZE = 4096;
const MAX_PROCESSES = 1000;
const MUTATION_RATE = 0.001;
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
        word |= (valA & 0xFFF) << 14;
        word |= (modeB & 0x3) << 12;
        word |= (valB & 0xFFF);
        return word;
    }

    static decode(word) {
        const op = (word >>> 28) & 0xF;
        const modeA = (word >>> 26) & 0x3;
        let valA = (word >>> 14) & 0xFFF;
        const modeB = (word >>> 12) & 0x3;
        let valB = word & 0xFFF;

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
        this.color = parent ? parent.color : `hsl(${Math.random() * 360}, 100%, 50%)`;
    }
}

class VM {
    constructor() {
        this.memory = new Int32Array(MEMORY_SIZE).fill(0);
        this.memoryMap = new Array(MEMORY_SIZE).fill(null);
        this.processes = [];
        this.cycles = 0;
    }

    reset() {
        this.memory.fill(0);
        this.memoryMap.fill(null);
        this.processes = [];
        this.cycles = 0;
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
        if (Math.random() < MUTATION_RATE) {
             const bit = Math.floor(Math.random() * 32);
             finalValue ^= (1 << bit);
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
            let jumped = false;

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
                            jumped = true;
                        }
                        break;
                    }
                    case OPCODES.JZ: {
                        const valB = this.getVal(p, instr.modeB, instr.valB);
                        if (valB === 0) {
                            const target = this.getAddr(p, instr.modeA, instr.valA);
                             if (target >= 0) {
                                newIP = target;
                                jumped = true;
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
                                jumped = true;
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

// --- Visualization & UI ---

let vm;
let animationId;
let isRunning = false;
let speed = 50;

function init() {
    vm = new VM();

    // Inject Ancestor
    // A simple replicator:
    // It needs to copy its own code to a new location.
    // Length of program = L.
    // 0: MOV $0, $(OFFSET)  ; Copy instr at 0 to Offset
    // 1: MOV $1, $(OFFSET)
    // ...
    // L: SPWN $(OFFSET)
    // L+1: JMP 0 (Restart or just wait)

    // Better Loop:
    // Registers: R0 (Source Index), R1 (Dest Index), R2 (Counter)
    // 0: MOV #0, %0        ; R0 = 0
    // 1: MOV #100, %1      ; R1 = 100 (Offset to copy to, relatively?)
    //    Wait, relative addressing is easier.
    //    Let's try a tight loop copying code.
    //    Source: IP + index
    //    Dest: IP + Offset + index

    // Ancestor Code:
    // 0: MOV #0, %0      (Init counter i=0)
    // 1: MOV #350, %1    (Offset D=350)
    // Loop:
    // 2: MOV $0(%0), $0(%1) (Copy [IP+i] to [IP+D+i]?? No we don't have indexed relative)
    // We have REG_INDIRECT ($R0). That is absolute address.
    // We need to calculate absolute addresses?
    // JMP/MOV instructions use Relative addressing mostly.

    // Replicator Strategy using Relative Addressing:
    // We need to read self.
    // MOV $0, $Offset
    // But we need to increment addresses.
    // We can modify the instruction itself! (Self-modifying code)

    // 0: MOV $0, $50    ; Copy instruction at IP+0 to IP+50.
    // 1: ADD #1, $0.-1  ; Increment source field of instruction 0 (Wait, complicated)
    // 2: ADD #1, $0.-2  ; Increment dest field of instruction 0

    // Let's use Registers for pointers.
    // R0 = Source Address (Absolute)
    // R1 = Dest Address (Absolute)
    // How to get current IP into Register?
    // JMP can't push to stack.
    // We can assume we start at 0.

    // Hardcoded replicator for now:
    // Copy 8 instructions.
    // Source: 0. Dest: random?

    const PROG_SIZE = 8;
    const TARGET_OFFSET = 100; // Copy to +100

    // We will hardcode the MOV instructions for simplicity in this demo version
    // MOV <Src>, <Dst>
    // 0: MOV $0, $100
    // 1: MOV $0, $100
    // ...
    // But this copies instruction 0 and 1 correctly?
    // "MOV $0, $100" at index 0 reads index 0 and writes to index 100.
    // "MOV $0, $100" at index 1 reads index 1 and writes to index 101.
    // YES! Relative addressing makes this trivial!
    // If I have "MOV $0, $100" at address X.
    // It reads X+0. Writes X+100.
    // If I have the *same* instruction "MOV $0, $100" at address X+1.
    // It reads X+1+0. Writes X+1+100.

    // So a replicator is just N instructions of "MOV $0, $TargetOffset"
    // Followed by "SPWN $TargetOffset"
    // Followed by "JMP 0" (Start over? or find new spot)

    const offset = 128;

    // Create the "Cell"
    const program = [];

    // The loop body size is, say, 10 instructions.
    // We need to copy 10 instructions.
    for(let i=0; i<10; i++) {
        // MOV $0, $offset
        // Reads (IP+0), Writes (IP+offset).
        // Since IP increments, this copies the current instruction to the relative target.
        program.push(Instruction.encode(OPCODES.MOV, MODES.RELATIVE, 0, MODES.RELATIVE, offset));
    }

    // Spawn the child
    // SPWN $offset (relative to this instruction's IP)
    // Note: The SPWN instruction is at index 10.
    // The child code starts at `offset` relative to index 0?
    // No, the child code was written to [IP - 10 + offset] ... [IP - 1 + offset]
    // The first instruction was written to (IP of instr 0) + offset.
    // Current IP is (IP of instr 0) + 10.
    // So we need to spawn at (IP - 10 + offset).
    program.push(Instruction.encode(OPCODES.SPWN, MODES.RELATIVE, offset - 10, 0, 0));

    // Jump to start (IP - 11) to repeat?
    // Maybe mutate the offset to spread?
    // ADD #128, $-2 (Modify the offset of the MOV instructions? No, that's hard)
    // Just die.
    program.push(Instruction.encode(OPCODES.DIE, 0, 0, 0, 0));

    // Load to memory
    const startAddr = Math.floor(MEMORY_SIZE / 2);
    for(let i=0; i<program.length; i++) {
        vm.memory[startAddr + i] = program[i];
        vm.memoryMap[startAddr + i] = 'white';
    }

    vm.addProcess(startAddr);

    draw();
    updateStats();
}

function loop() {
    if (!isRunning) return;

    // Run 'speed' cycles per frame
    for(let k=0; k<speed; k++) {
        vm.step();
    }

    draw();
    updateStats();
    animationId = requestAnimationFrame(loop);
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
            ctx.fillRect(x, y, cellW - 1, cellH - 1);
        } else if (vm.memory[i] !== 0) {
            ctx.fillStyle = '#333'; // Dead data
            ctx.fillRect(x, y, cellW - 1, cellH - 1);
        }
    }

    // Draw IPs
    for (let p of vm.processes) {
        const i = p.ip;
        const x = (i % cols) * cellW;
        const y = Math.floor(i / cols) * cellH;

        ctx.fillStyle = '#fff';
        ctx.fillRect(x+1, y+1, cellW-3, cellH-3);
    }
}

function updateStats() {
    const stats = document.getElementById('stats');
    if(stats) {
        stats.innerText = `Active Processes: ${vm.processes.length} | Cycles: ${vm.cycles}`;
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
        init();
    });

    document.getElementById('speedRange').addEventListener('input', (e) => {
        speed = parseInt(e.target.value);
    });

    // Start
    init();
}

// Export for node testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MEMORY_SIZE, OPCODES, MODES, Instruction, VM, Process };
}
