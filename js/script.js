// ======================
// SLIDE CARA BERMAIN
// ======================
let currentSlide = 0;
const slides = document.querySelectorAll(".slide");
function showSlide(i){ slides.forEach(s=>s.classList.remove("active-slide")); slides[i].classList.add("active-slide"); }
function nextSlide(){ if(currentSlide < slides.length-1){ currentSlide++; showSlide(currentSlide); } }
function prevSlide(){ if(currentSlide > 0){ currentSlide--; showSlide(currentSlide); } }

// ======================
// SCORE SYSTEM
// ======================

// AMBIL SCORE YANG TERSIMPAN
let score = parseInt(localStorage.getItem("score")) || 0;

// AMBIL HIGH SCORE
let highScore = parseInt(localStorage.getItem("highScore")) || 0;


// UPDATE SCORE
function updateScore(val){

    score += val;

    // Biar tidak minus
    if(score < 0){
        score = 0;
    }

    // SIMPAN SCORE
    localStorage.setItem("score", score);

    // TAMPILKAN SCORE
    document.getElementById("score").innerText = score;

    // TAMPILKAN POIN SHOP
    document.getElementById("shopPoint").innerText = score;

    // HIGH SCORE
    if(score > highScore){

        highScore = score;

        localStorage.setItem("highScore", highScore);

        document.getElementById("highScore").innerText = highScore;
    }
}


// TAMPILKAN DATA SAAT GAME DIBUKA
document.getElementById("score").innerText = score;

document.getElementById("shopPoint").innerText = score;

document.getElementById("highScore").innerText = highScore;

// ======================
// ELEMENTS
// ======================
const player    = document.getElementById("player");
const coin      = document.getElementById("coin");
const enemies   = document.querySelectorAll(".enemy");
const jumpSound = document.getElementById("jumpSound");
const coinSound = document.getElementById("coinSound");
const hitSound  = document.getElementById("hitSound");
const bgMusic   = document.getElementById("bgMusic");

// ======================
// CONSTANTS
// ======================
const PLAYER_W   = 80;
const PLAYER_H   = 110;
const GROUND_Y   = 120;   // bottom position saat di tanah
const GRAVITY    = 0.65;
const JUMP_FORCE = -17;   // negatif = ke atas
const MOVE_SPEED = 7;     // px per frame (30ms interval)
const MAX_SPEED  = 7;     // batas kecepatan X (tidak bertambah saat ditahan)

// Brick definitions — harus sesuai CSS
const BRICKS = [
    { left:350, bottom:260, w:70, h:70 },
    { left:450, bottom:260, w:70, h:70 },
    { left:550, bottom:260, w:70, h:70 },
];

// ======================
// GAME STATE
// ======================
let life        = 3;
let playerX     = 100;
let playerY     = GROUND_Y;
let velY        = 0;
let isJumping   = false;
let isInvincible= false;   // kebal saat kena musuh
let gameRunning = false;

// Track passed
const enemyPassed = new Set();
const brickPassed = new Set();

// Berapa lama di atas brick (untuk +1 per interval)
let onBrickTimer  = {};    // { brickIndex: frameCount }
const ON_BRICK_INTERVAL = 20; // tiap 20 passedLoop tick (~2 detik) +1

// ======================
// NAVIGASI
// ======================
function startGame(){
    document.getElementById("homePage").classList.remove("active-page");
    document.getElementById("gamePage").classList.add("active-page");
    bgMusic.volume = 0.4;
    bgMusic.play();
    gameRunning = true;
    requestAnimationFrame(physicsLoop);
    setInterval(collisionLoop, 50);
    setInterval(passedLoop, 100);
}
function openCara(){
    document.getElementById("homePage").classList.remove("active-page");
    document.getElementById("caraPage").classList.add("active-page");
}
function backHome(){
    document.getElementById("caraPage").classList.remove("active-page");
    document.getElementById("homePage").classList.add("active-page");
}
function openKarakter(){
    document.getElementById("homePage").classList.remove("active-page");
    document.getElementById("karakterPage").classList.add("active-page");
    document.getElementById("shopPoint").innerText = score;
}
function backHomeKarakter(){
    document.getElementById("karakterPage").classList.remove("active-page");
    document.getElementById("homePage").classList.add("active-page");
}

// ======================
// HEART
// ======================
function updateHeart(){
    document.getElementById("heart3").classList.toggle("lost", life < 3);
    document.getElementById("heart2").classList.toggle("lost", life < 2);
    document.getElementById("heart1").classList.toggle("lost", life < 1);
}

// ======================
// MOVE — kecepatan tetap MAX_SPEED, tidak nambah terus
// ======================
function moveLeft(){
    if(!gameRunning) return;
    playerX -= MOVE_SPEED;
    if(playerX < 0) playerX = 0;
    player.style.left = playerX + "px";
}
function moveRight(){
    if(!gameRunning) return;
    playerX += MOVE_SPEED;
    if(playerX > window.innerWidth - PLAYER_W) playerX = window.innerWidth - PLAYER_W;
    player.style.left = playerX + "px";
}

// ======================
// INPUT — keyboard
// ======================
const keysHeld = {};
document.addEventListener("keydown", e=>{
    if(e.repeat) return;
    keysHeld[e.code] = true;
    if(e.code === "Space"){ e.preventDefault(); jump(); }
});
document.addEventListener("keyup", e=>{ keysHeld[e.code] = false; });

// Tahan kiri/kanan tiap 30ms — kecepatan fixed, tidak accelerate
setInterval(()=>{
    if(!gameRunning) return;
    if(keysHeld["ArrowLeft"])  moveLeft();
    if(keysHeld["ArrowRight"]) moveRight();
}, 30);

// ======================
// INPUT — mobile
// ======================
function bindHold(btn, fn){
    let iv = null;
    const start = e=>{ e.preventDefault(); fn(); iv = setInterval(fn, 30); };
    const stop  = ()=>{ clearInterval(iv); iv = null; };
    btn.addEventListener("touchstart",  start, {passive:false});
    btn.addEventListener("touchend",    stop);
    btn.addEventListener("touchcancel", stop);
    btn.addEventListener("mousedown",   start);
    btn.addEventListener("mouseup",     stop);
    btn.addEventListener("mouseleave",  stop);
}
window.addEventListener("DOMContentLoaded", ()=>{
    const btns = document.querySelectorAll(".mobile-control button");
    if(btns[0]) bindHold(btns[0], moveLeft);
    if(btns[1]) bindHold(btns[1], moveRight);
    if(btns[2]){
        btns[2].addEventListener("touchstart", e=>{ e.preventDefault(); jump(); }, {passive:false});
        btns[2].addEventListener("mousedown",  ()=>jump());
    }
});

// ======================
// JUMP
// ======================
function jump(){
    if(isJumping) return;
    isJumping = true;
    velY = JUMP_FORCE;
    jumpSound.currentTime = 0;
    jumpSound.play();
}

// ======================
// PHYSICS LOOP
// ======================
function physicsLoop(){
    if(!gameRunning) return;

    // Gravity selalu berlaku
    velY    += GRAVITY;
    playerY -= velY;   // bottom coord: dikurangi = turun, ditambah = naik

    let landed = false;

    // --- Brick collision ---
    // Aturan: player HANYA bisa naik dari samping (berjalan ke tepi lalu jatuh ke atas),
    // TIDAK bisa melompat tembus dari bawah.
    // Implementasi:
    //   - Jika player jatuh (velY > 0) dan kaki player mencapai top brick dari atas → landing
    //   - Jika player naik (velY < 0) dan kepala player mengenai bawah brick → tolak ke bawah (kepala mentok)
    for(const brick of BRICKS){
        const bTop    = brick.bottom + brick.h;  // top surface (bottom coords)
        const bBottom = brick.bottom;            // bottom surface
        const bLeft   = brick.left;
        const bRight  = brick.left + brick.w;

        const pLeft   = playerX;
        const pRight  = playerX + PLAYER_W;
        const pFeet   = playerY;               // kaki player (bottom)
        const pHead   = playerY + PLAYER_H;    // kepala player (bottom coords)

        const overlapX = pRight > bLeft + 3 && pLeft < bRight - 3;

        if(overlapX){
            // LANDING dari atas: player jatuh, kaki menyentuh top brick
            if(velY > 0 && pFeet <= bTop && pFeet >= bTop - (velY + 3)){
                playerY = bTop;
                velY    = 0;
                isJumping = false;
                landed  = true;
                break;
            }
            // TETAP BERDIRI di atas brick
            if(pFeet >= bTop - 1 && pFeet <= bTop + 2 && velY >= 0){
                playerY = bTop;
                velY    = 0;
                isJumping = false;
                landed  = true;
                break;
            }
            // KEPALA MENTOK dari bawah: player lompat ke atas, kepala mengenai bawah brick
            // → tolak ke bawah (tidak bisa tembus)
            if(velY < 0 && pHead >= bBottom && pHead <= bBottom + (-velY + 3)){
                playerY = bBottom - PLAYER_H; // dorong player ke bawah
                velY    = 0.5;                // mulai jatuh kembali
                break;
            }
        }
    }

    // --- Ground ---
    if(playerY <= GROUND_Y){
        playerY   = GROUND_Y;
        velY      = 0;
        isJumping = false;
    }

    player.style.bottom = playerY + "px";
    requestAnimationFrame(physicsLoop);
}

// ======================
// COLLISION LOOP
// ======================
function collisionLoop(){
    if(!gameRunning) return;

    const pRect = player.getBoundingClientRect();

    // --- Coin ---
    const cRect = coin.getBoundingClientRect();
    if(rectsOverlap(pRect, cRect)){
        updateScore(10);
        coinSound.currentTime = 0;
        coinSound.play();
        showFloatingText("+10 🪙", pRect.left, pRect.top);
        // Respawn coin
        coin.style.animation = "none";
        coin.style.right = "-100px";
        coin.style.top   = (Math.random()*160 + 180) + "px";
        void coin.offsetWidth;
        coin.style.animation = "coinMove 5s linear infinite";
    }

    // --- Enemy ---
    if(isInvincible) return; // kebal, skip deteksi

    enemies.forEach(enemy => {
        const eRect = enemy.getBoundingClientRect();
        const hOvlp = pRect.left < eRect.right  && pRect.right  > eRect.left;
        const vOvlp = pRect.top  < eRect.bottom && pRect.bottom > eRect.top;

        // Stomp: jatuh dari atas ke kepala musuh
        const stomping =
            hOvlp &&
            pRect.bottom >= eRect.top - 14 &&
            pRect.bottom <= eRect.top + 24 &&
            velY > 0;

        if(stomping){
            velY = JUMP_FORCE * 0.5;
            isJumping = true;
            resetEnemy(enemy);
            updateScore(20);
            showFloatingText("+20 💥", pRect.left, pRect.top);
            coinSound.currentTime = 0;
            coinSound.play();
            return;
        }

        if(hOvlp && vOvlp && !stomping){
            takeDamage();
        }
    });
}

function rectsOverlap(a, b){
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function resetEnemy(enemy){
    enemy.style.animation = "none";
    enemy.style.left = "-200px";
    void enemy.offsetWidth;
    setTimeout(()=>{ enemy.style.animation=""; enemy.style.left=""; }, 1500);
}

// ======================
// DAMAGE + INVINCIBILITY FLASH
// ======================
function takeDamage(){
    if(isInvincible) return;
    isInvincible = true;
    life--;
    updateHeart();
    hitSound.currentTime = 0;
    hitSound.play();

    if(life <= 0){
        gameRunning = false;
        player.classList.remove("player-flash");
        showGameOver();
        return;
    }

    // Flash effect: player berkedip selama 2.5 detik
    player.classList.add("player-flash");
    setTimeout(()=>{
        player.classList.remove("player-flash");
        isInvincible = false;
    }, 2500);
}

// ======================
// PASSED LOOP
// ======================
function passedLoop(){
    if(!gameRunning) return;

    // Enemy dilewati
    enemies.forEach((enemy, i)=>{
        const eRect = enemy.getBoundingClientRect();
        const pRect = player.getBoundingClientRect();
        if(eRect.right < pRect.left && !enemyPassed.has(i)){
            enemyPassed.add(i);
            updateScore(1);
            showFloatingText("+1", pRect.left, pRect.top);
        }
        if(eRect.left > window.innerWidth * 0.8) enemyPassed.delete(i);
    });

    // Brick: +1 saat dilewati; +1 ekstra setiap interval saat berdiri di atas
    BRICKS.forEach((brick, i)=>{
        const bTop   = brick.bottom + brick.h;
        const bRight = brick.left + brick.w;

        // Apakah player sedang berdiri tepat di atas brick ini?
        const standingOn =
            playerX + PLAYER_W > brick.left + 3 &&
            playerX             < bRight - 3 &&
            Math.abs(playerY - bTop) <= 2;

        // +1 per interval saat di atas brick (bonus standing)
        if(standingOn){
            onBrickTimer[i] = (onBrickTimer[i] || 0) + 1;
            if(onBrickTimer[i] >= ON_BRICK_INTERVAL){
                onBrickTimer[i] = 0;
                updateScore(1);
                const pRect = player.getBoundingClientRect();
                showFloatingText("+1 ⭐", pRect.left, pRect.top - 20);
            }
        } else {
            onBrickTimer[i] = 0;
        }

        // +1 saat pertama kali melewati brick (dari kiri ke kanan)
        // Syarat: sudah di sebelah kanan brick, TIDAK lagi melayang di atas area brick
        const flyingOver =
            playerX + PLAYER_W > brick.left &&
            playerX             < bRight &&
            playerY > bTop + 5; // masih di udara di atas brick = belum benar-benar lewat

        if(playerX > bRight && !standingOn && !flyingOver && !brickPassed.has(i)){
            brickPassed.add(i);
            updateScore(1);
            const pRect = player.getBoundingClientRect();
            showFloatingText("+1", pRect.left, pRect.top);
        }
        if(playerX < brick.left - PLAYER_W) brickPassed.delete(i);
    });
}

// ======================
// FLOATING TEXT
// ======================
function showFloatingText(text, x, y){
    const el = document.createElement("div");
    el.innerText = text;
    el.style.cssText = `
        position:fixed; left:${x}px; top:${y-10}px;
        color:gold; font-size:20px; font-weight:bold;
        text-shadow:2px 2px black; pointer-events:none;
        z-index:9999; animation:floatUp 0.8s ease forwards;
    `;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 800);
}
if(!document.getElementById("floatStyle")){
    const st = document.createElement("style");
    st.id = "floatStyle";
    st.textContent = `
        @keyframes floatUp{
            from{ opacity:1; transform:translateY(0); }
            to{   opacity:0; transform:translateY(-40px); }
        }
        @keyframes playerFlash{
            0%,100%{ opacity:1; }
            50%{ opacity:0.15; }
        }
        .player-flash{
            animation: playerFlash 0.25s linear infinite;
        }
    `;
    document.head.appendChild(st);
}

// ======================
// GAME OVER
// ======================
function showGameOver(){
    const screen = document.getElementById("gameOverScreen");
    document.getElementById("finalScore").innerText     = score;
    document.getElementById("finalHighScore").innerText = highScore;
    screen.style.display = "flex";
}
// ======================
// RESTART GAME
// ======================
function restartGame(){

    // tutup game over
    document.getElementById("gameOverScreen").style.display = "none";

    // reset status
    isInvincible = false;
    player.classList.remove("player-flash");

    // reset nyawa
    life = 3;
    updateHeart();

    // reset posisi
    playerX = 100;
    playerY = GROUND_Y;
    velY = 0;
    isJumping = false;

    player.style.left = playerX + "px";
    player.style.bottom = playerY + "px";

    gameRunning = true;

    requestAnimationFrame(physicsLoop);
}

function backMenu(){

    document.getElementById("gamePage").classList.remove("active-page");
    document.getElementById("homePage").classList.add("active-page");

    document.getElementById("gameOverScreen").style.display = "none";

    gameRunning = false;
}

// ======================
// CHARACTER SYSTEM
// ======================
let unlockedCharacters = JSON.parse(localStorage.getItem("unlockedCharacters"))
    || { red:true, green:false, blue:false };

function pilihKarakter(hatColor, bodyColor, harga){
    if(harga === 0){ gantiKarakter(hatColor, bodyColor); return; }
    if(unlockedCharacters[hatColor]){ gantiKarakter(hatColor, bodyColor); return; }
    if(score >= harga){
        unlockedCharacters[hatColor] = true;
        localStorage.setItem("unlockedCharacters", JSON.stringify(unlockedCharacters));
        gantiKarakter(hatColor, bodyColor);
        alert("Karakter berhasil dibeli!");
    } else {
        alert("Poin belum cukup!");
    }
}
function gantiKarakter(hatColor, bodyColor){
    document.getElementById("playerHat").style.background  = hatColor;
    document.getElementById("playerBody").style.background = bodyColor;
    alert("Karakter digunakan!");
}