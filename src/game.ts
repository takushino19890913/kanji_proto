import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// ゲームの基本的なデータ構造を定義
interface CakePiece {
  id: number;
  mesh: THREE.Mesh;
  isStealing: boolean;
  isStolen: boolean;
}

interface Ant {
  id: number;
  mesh: THREE.Group;
  kanji: string;
  reading: string;
  state: 'approaching' | 'stealing' | 'escaping';
  pauseTime: number;
  targetPieceId: number | null;
  carryingPiece: boolean;
}

// グローバル変数の宣言
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let clock: THREE.Clock;

// ゲームの状態を管理するオブジェクト
let gameState = {
  score: 0,
  gameOver: false,
  isInitialized: false,
};

// HTML要素への参照を保持する変数
let inputField: HTMLInputElement;
let scoreDisplay: HTMLElement;
let cakePiecesDisplay: HTMLElement;
let gameOverScreen: HTMLElement;
let finalScoreDisplay: HTMLElement;

// ゲームオブジェクトを保持する配列
let cakePieces: CakePiece[] = [];
let ants: Ant[] = [];
let antModels: THREE.Group[] = [];
let cakeModel: THREE.Group;

// ゲームで使用する漢字とその読み方のリスト
const kanjiList = [
  { kanji: '日', reading: 'hi' },
  { kanji: '月', reading: 'tsuki' },
  { kanji: '火', reading: 'hi' },
  { kanji: '水', reading: 'mizu' },
  { kanji: '木', reading: 'ki' },
  { kanji: '金', reading: 'kin' },
  { kanji: '土', reading: 'tsuchi' },
  { kanji: '山', reading: 'yama' },
  { kanji: '川', reading: 'kawa' },
  { kanji: '田', reading: 'ta' },
];

// アセットのロード
const loader = new GLTFLoader();
const antGLBPath = 'assets/ant_model.glb';
const cakeGLBPath = 'assets/cake_model.glb';

// ライトの設定
function addLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 100, 50);
  scene.add(directionalLight);
}

// ゲームの初期化関数
function init() {
  // シーンの設定
  scene = new THREE.Scene();

  // カメラの設定
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;
  camera = new THREE.PerspectiveCamera(
    75,
    canvasWidth / canvasHeight,
    0.1,
    1000
  );
  camera.position.set(0, 150, 400);
  camera.lookAt(0, 0, 0);

  // レンダラーの設定
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(canvasWidth, canvasHeight);
  document.body.appendChild(renderer.domElement);

  // 時計の設定
  clock = new THREE.Clock();

  // HTML要素の取得
  inputField = document.getElementById('inputField') as HTMLInputElement;
  scoreDisplay = document.getElementById('score')!;
  cakePiecesDisplay = document.getElementById('cakePieces')!;
  gameOverScreen = document.getElementById('gameOverScreen')!;
  finalScoreDisplay = document.getElementById('finalScore')!;

  // イベントリスナーの設定
  window.addEventListener('resize', onWindowResize);
  document
    .getElementById('inputForm')!
    .addEventListener('submit', handleSubmit);

  // ライトの追加
  addLights();

  // ケーキとアリのモデルをロードしてゲーム開始
  loadModels();
}

// モデルのロード
function loadModels() {
  // ケーキモデルのロード
  loader.load(
    cakeGLBPath,
    gltf => {
      cakeModel = gltf.scene;
      createCakePieces();
      gameState.isInitialized = true;

      // アリの生成を定期的に行う
      setInterval(createAnt, 3000);

      // ゲームループの開始
      animate();
    },
    undefined,
    error => {
      console.error('ケーキモデルの読み込みに失敗しました', error);
    }
  );

  // アリモデルのロード
  loader.load(
    antGLBPath,
    gltf => {
      antModels.push(gltf.scene);
    },
    undefined,
    error => {
      console.error('アリモデルの読み込みに失敗しました', error);
    }
  );
}

// ウィンドウリサイズ時の処理
function onWindowResize() {
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

  camera.aspect = canvasWidth / canvasHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(canvasWidth, canvasHeight);
}

// ケーキピースの作成
function createCakePieces() {
  const numPieces = 6;
  const cakeRadius = 100;

  cakePieces = [];

  // ケーキモデルをシーンに追加
  scene.add(cakeModel);

  // 6つのケーキピースを角度で配置
  for (let i = 0; i < numPieces; i++) {
    const piece = cakeModel.clone();

    // 各ピースを回転
    const angle = (i / numPieces) * Math.PI * 2;
    piece.rotation.y = angle;

    // ピースを配列に追加
    cakePieces.push({
      id: i,
      mesh: piece,
      isStealing: false,
      isStolen: false,
    });
  }
}

// アリの生成
function createAnt() {
  if (gameState.gameOver || antModels.length === 0) return;

  // ランダムな位置を計算
  const angle = Math.random() * Math.PI * 2;
  const radius = 300;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  // ランダムな漢字を選択
  const randomKanji = kanjiList[Math.floor(Math.random() * kanjiList.length)];

  // 利用可能なケーキピースを探す
  const availablePieces = cakePieces.filter(piece => !piece.isStolen);
  if (availablePieces.length === 0) return;

  // 最も近いケーキピースを見つける
  let minDistance = Infinity;
  let closestPiece: CakePiece | null = null;
  for (const piece of availablePieces) {
    const dx = piece.mesh.position.x - x;
    const dz = piece.mesh.position.z - z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < minDistance) {
      minDistance = distance;
      closestPiece = piece;
    }
  }

  if (!closestPiece) return;

  // アリのモデルをクローン
  const antMesh = antModels[0].clone();
  antMesh.position.set(x, 0, z);
  scene.add(antMesh);

  // 漢字テキストを作成
  const kanjiSprite = createTextSprite(randomKanji.kanji);
  kanjiSprite.position.set(0, 30, 0);
  antMesh.add(kanjiSprite);

  // アリオブジェクトの作成
  const ant: Ant = {
    id: Date.now(),
    mesh: antMesh,
    kanji: randomKanji.kanji,
    reading: randomKanji.reading,
    state: 'approaching',
    pauseTime: 0,
    targetPieceId: closestPiece.id,
    carryingPiece: false,
  };

  ants.push(ant);
}

// テキストをスプライトとして作成
function createTextSprite(message: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  context.font = 'Bold 24px Arial';
  context.fillStyle = 'white';
  context.fillText(message, 0, 24);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(50, 25, 1);
  return sprite;
}

// ゲームループ
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  update(delta);
  renderer.render(scene, camera);
}

// ゲーム状態の更新
function update(delta: number) {
  // アリの更新処理
  ants = ants.filter(ant => {
    const antPosition = ant.mesh.position;
    const targetPiece = cakePieces.find(p => p.id === ant.targetPieceId);

    if (!targetPiece) return false;

    const targetPosition = targetPiece.mesh.position;

    switch (ant.state) {
      case 'approaching':
        // ターゲットに向かって移動
        const dir = new THREE.Vector3()
          .subVectors(targetPosition, antPosition)
          .normalize();
        ant.mesh.position.addScaledVector(dir, delta * 50);

        // ターゲットに到達したら、stealing状態に移行
        if (antPosition.distanceTo(targetPosition) < 5) {
          ant.state = 'stealing';
          ant.pauseTime = clock.getElapsedTime();
        }

        // アリの向きを更新
        ant.mesh.lookAt(targetPosition);

        break;
      case 'stealing':
        // 1秒間待機後、ケーキピースを盗む
        if (clock.getElapsedTime() - ant.pauseTime > 1) {
          ant.state = 'escaping';
          ant.carryingPiece = true;
          targetPiece.isStealing = true;
          scene.remove(targetPiece.mesh);
        }
        break;
      case 'escaping':
        // 画面の外に向かって逃げる
        const escapeDir = antPosition.clone().normalize();
        ant.mesh.position.addScaledVector(escapeDir, delta * 50);

        // アリの向きを更新
        ant.mesh.lookAt(antPosition.clone().add(escapeDir));

        // 画面外に出たらアリを削除
        if (antPosition.length() > 500) {
          targetPiece.isStolen = true;
          updateCakePiecesDisplay();
          checkGameOver();
          scene.remove(ant.mesh);
          return false;
        }
        break;
    }
    return true;
  });
}

// 入力処理
function handleSubmit(event: Event) {
  event.preventDefault();
  const input = inputField.value.trim().toLowerCase();
  inputField.value = '';
  const index = ants.findIndex(
    ant => ant.reading.toLowerCase() === input
  );
  if (index !== -1) {
    const ant = ants[index];
    scene.remove(ant.mesh);
    ants.splice(index, 1);
    gameState.score += 1;
    scoreDisplay.textContent = gameState.score.toString();
  }
}

// 残りのケーキピース数の表示を更新
function updateCakePiecesDisplay() {
  const remainingPieces = cakePieces.filter(piece => !piece.isStolen)
    .length;
  cakePiecesDisplay.textContent = remainingPieces.toString();
}

// ゲームオーバーのチェック
function checkGameOver() {
  const remainingPieces = cakePieces.filter(piece => !piece.isStolen)
    .length;
  if (remainingPieces === 0) {
    gameState.gameOver = true;
    finalScoreDisplay.textContent = gameState.score.toString();
    gameOverScreen.style.display = 'flex';
  }
}

// ページ読み込み時にゲームを初期化
window.onload = init;