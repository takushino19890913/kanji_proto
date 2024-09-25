"use strict";
// game.ts
// ゲームで使用する漢字とその読み方のリスト
const kanjiList = [
    { kanji: "日", reading: "hi" },
    { kanji: "月", reading: "tsuki" },
    { kanji: "火", reading: "hi" },
    { kanji: "水", reading: "mizu" },
    { kanji: "木", reading: "ki" },
    { kanji: "金", reading: "kin" },
    { kanji: "土", reading: "tsuchi" },
    { kanji: "山", reading: "yama" },
    { kanji: "川", reading: "kawa" },
    { kanji: "田", reading: "ta" },
];
// グローバル変数の宣言
let canvas;
let ctx;
// ゲームの状態を管理するオブジェクト
let gameState = {
    score: 0,
    gameOver: false,
    isInitialized: false,
};
// HTML要素への参照を保持する変数
let inputField;
let scoreDisplay;
let cakePiecesDisplay;
let gameOverScreen;
let finalScoreDisplay;
// ゲームオブジェクトを保持する配列
let cakePieces = [];
let ants = [];
// ゲームの初期化関数
function init() {
    // キャンバスの設定
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    resizeCanvas();
    // HTML要素の取得
    inputField = document.getElementById("inputField");
    scoreDisplay = document.getElementById("score");
    cakePiecesDisplay = document.getElementById("cakePieces");
    gameOverScreen = document.getElementById("gameOverScreen");
    finalScoreDisplay = document.getElementById("finalScore");
    // イベントリスナーの設定
    window.addEventListener("resize", resizeCanvas);
    document
        .getElementById("inputForm")
        .addEventListener("submit", handleSubmit);
    // ケーキピースの作成
    createCakePieces();
    gameState.isInitialized = true;
    // アリの生成を定期的に行う
    setInterval(createAnt, 3000);
    // ゲームループの開始
    requestAnimationFrame(gameLoop);
}
// キャンバスのリサイズ処理
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
// ケーキピースの作成
function createCakePieces() {
    const numPieces = 6;
    const cakeRadius = 200;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    cakePieces = [];
    // 6つのケーキピースを円形に配置
    for (let i = 0; i < numPieces; i++) {
        const angle = (i / numPieces) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * cakeRadius;
        const y = centerY + Math.sin(angle) * cakeRadius;
        cakePieces.push({
            id: i,
            position: { x, y },
            isSteeling: false,
            isStolen: false,
        });
    }
}
// アリの生成
function createAnt() {
    if (gameState.gameOver)
        return;
    // アリの初期位置と速度を設定
    const speed = Math.random() * 0.5 + 0.5;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.max(canvas.width, canvas.height);
    // アリが出現する範囲を設定
    // スクリーンの辺上からアリを出現させる
    let x, y;
    if (Math.random() < 0.5) {
        // 左右の辺から出現
        x = Math.random() < 0.5 ? 0 : canvas.width;
        y = Math.random() * canvas.height;
    }
    else {
        // 上下の辺から出現
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? 0 : canvas.height;
    }
    // ランダムな漢字を選択
    const randomKanji = kanjiList[Math.floor(Math.random() * kanjiList.length)];
    // 利用可能なケーキピースを探す
    const availablePieces = cakePieces.filter((piece) => !piece.isStolen);
    if (availablePieces.length === 0)
        return;
    // 最も近いケーキピースを見つける
    let minDistance = Infinity;
    let closestPiece = null;
    for (const piece of availablePieces) {
        const dx = x - piece.position.x;
        const dy = y - piece.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
            minDistance = distance;
            closestPiece = piece;
        }
    }
    // アリオブジェクトの作成
    const ant = {
        id: Date.now(),
        position: { x, y },
        speed,
        kanji: randomKanji.kanji,
        reading: randomKanji.reading,
        state: "approaching",
        pauseTime: 0,
        targetPieceId: closestPiece ? closestPiece.id : null,
        targetPosition: closestPiece ? Object.assign({}, closestPiece.position) : null,
        carryingPiece: false,
    };
    ants.push(ant);
}
// ゲームループ
function gameLoop() {
    update();
    draw();
    if (!gameState.gameOver) {
        requestAnimationFrame(gameLoop);
    }
}
// ゲーム状態の更新
function update() {
    // アリの更新処理
    ants = ants.filter((ant) => {
        switch (ant.state) {
            case "approaching":
                // ターゲットに向かって移動
                if (ant.targetPosition) {
                    //target positionの更新
                    const piece = cakePieces.find((p) => p.id === ant.targetPieceId);
                    if (piece) {
                        ant.targetPosition.x = piece.position.x;
                        ant.targetPosition.y = piece.position.y;
                    }
                    const dx = ant.targetPosition.x - ant.position.x;
                    const dy = ant.targetPosition.y - ant.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 1) {
                        // ターゲットに到達したら、stealing状態に移行
                        ant.state = "stealing";
                        ant.pauseTime = Date.now();
                    }
                    else {
                        // ターゲットに向かって移動
                        ant.position.x += (dx / distance) * ant.speed;
                        ant.position.y += (dy / distance) * ant.speed;
                    }
                }
                break;
            case "stealing":
                // 1秒間待機後、ケーキピースを盗む
                if (Date.now() - ant.pauseTime > 1000 && ant.targetPieceId !== null) {
                    ant.state = "escaping";
                    ant.carryingPiece = true;
                    const piece = cakePieces.find((p) => p.id === ant.targetPieceId);
                    if (piece) {
                        piece.isSteeling = true;
                    }
                }
                break;
            case "escaping":
                // 画面の外に向かって逃げる
                const dx = ant.position.x - canvas.width / 2;
                const dy = ant.position.y - canvas.height / 2;
                const distance = Math.sqrt(dx * dx + dy * dy);
                ant.position.x += (dx / distance) * ant.speed;
                ant.position.y += (dy / distance) * ant.speed;
                // 画面外に出たらアリを削除
                if (ant.position.x < 0 ||
                    ant.position.x > canvas.width ||
                    ant.position.y < 0 ||
                    ant.position.y > canvas.height) {
                    const piece = cakePieces.find((p) => p.id === ant.targetPieceId);
                    if (piece) {
                        piece.isStolen = true;
                        updateCakePiecesDisplay();
                        checkGameOver();
                    }
                    return false;
                }
                break;
        }
        return true;
    });
}
// ケーキピースの状態を更新
function updateCakePieceState(id, x, y) {
    const piece = cakePieces.find((p) => p.id === id);
    if (piece) {
        piece.position.x = x;
        piece.position.y = y;
    }
}
// ゲーム画面の描画
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const numPieces = 6;
    const cakeRadius = 200;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    // ケーキの描画
    for (const piece of cakePieces) {
        if (!piece.isSteeling) {
            drawCakePiece(piece.id, centerX, centerY, cakeRadius);
        }
    }
    // アリの描画
    for (const ant of ants) {
        // ケーキのピースを持っている場合、先に描画
        if (ant.carryingPiece && ant.targetPieceId !== null) {
            const pieceAngle = (ant.targetPieceId / numPieces) * Math.PI * 2 + Math.PI / numPieces;
            const contactX = ant.position.x + Math.cos(pieceAngle) * 10; // アリの半径分オフセット
            const contactY = ant.position.y + Math.sin(pieceAngle) * 10;
            const pieceOffsetX = Math.cos(pieceAngle) * cakeRadius;
            const pieceOffsetY = Math.sin(pieceAngle) * cakeRadius;
            drawCakePiece(ant.targetPieceId, contactX - pieceOffsetX, contactY - pieceOffsetY, cakeRadius);
            updateCakePieceState(ant.targetPieceId, contactX - pieceOffsetX, contactY - pieceOffsetY);
        }
        // アリの体の描画
        ctx.fillStyle = "#0000ff";
        ctx.beginPath();
        ctx.arc(ant.position.x, ant.position.y, 10, 0, Math.PI * 2);
        ctx.fill();
        // 漢字の描画
        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ant.kanji, ant.position.x, ant.position.y - 15);
    }
}
// ケーキピースの描画
function drawCakePiece(id, centerX, centerY, radius) {
    const numPieces = 6;
    const startAngle = (id / numPieces) * Math.PI * 2;
    const endAngle = ((id + 1) / numPieces) * Math.PI * 2;
    ctx.fillStyle = "#ffddaa";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.lineTo(centerX, centerY);
    ctx.closePath();
    ctx.fill();
    // 境界線を追加
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();
}
// 入力処理
function handleSubmit(event) {
    event.preventDefault();
    const input = inputField.value.trim().toLowerCase();
    inputField.value = "";
    const index = ants.findIndex((ant) => ant.reading.toLowerCase() === input);
    if (index !== -1) {
        ants.splice(index, 1);
        gameState.score += 1;
        scoreDisplay.textContent = gameState.score.toString();
    }
}
// 残りのケーキピース数の表示を更新
function updateCakePiecesDisplay() {
    const remainingPieces = cakePieces.filter((piece) => !piece.isStolen).length;
    cakePiecesDisplay.textContent = remainingPieces.toString();
}
// ゲームオーバーのチェック
function checkGameOver() {
    const remainingPieces = cakePieces.filter((piece) => !piece.isStolen).length;
    if (remainingPieces === 0) {
        gameState.gameOver = true;
        finalScoreDisplay.textContent = gameState.score.toString();
        gameOverScreen.style.display = "flex";
    }
}
// ページ読み込み時にゲームを初期化
window.onload = init;
//# sourceMappingURL=game.js.map