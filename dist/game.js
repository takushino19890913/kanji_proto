
// モジュールのインポート
import * as THREE from 'three';
import { GLTFLoader } from 'GLTFLoader';
import { CSG } from 'CSG';

// グローバル変数の宣言
let scene;
let camera;
let renderer;
let clock;

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
let antModels = [];
let cakeModel;

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

// アセットのパス（パスを正しく設定してください）
const antGLBPath = './assets/Ant.glb';
const cakeGLBPath = './assets/Cake.glb';

// ライトの設定
function addLights() {
  // 環境光を明るくする
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);

  // 平行光源を追加し、位置と強度を調整
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(100, 100, 100);
  scene.add(directionalLight);

  // 半球光を追加してより自然な照明を実現
  const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
  scene.add(hemisphereLight);
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
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(canvasWidth, canvasHeight);
  renderer.setClearColor(0xffffff, 1); // 背景色を白に設定し、透明度を1（不透明）に
  document.body.appendChild(renderer.domElement);

  // 時計の設定
  clock = new THREE.Clock();

  // HTML要素の取得
  inputField = document.getElementById('inputField');
  scoreDisplay = document.getElementById('score');
  cakePiecesDisplay = document.getElementById('cakePieces');
  gameOverScreen = document.getElementById('gameOverScreen');
  finalScoreDisplay = document.getElementById('finalScore');

  // イベントリスナーの設定
  window.addEventListener('resize', onWindowResize);
  document
    .getElementById('inputForm')
    .addEventListener('submit', handleSubmit);

  // ライトの追加
  addLights();

  // ケーキとアリのモデルをロードしてゲーム開始
  loadModels();
}

// ウィンドウのリサイズ時の処理
function onWindowResize() {
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

  // カメラのアスペクト比と投影行列を更新
  camera.aspect = canvasWidth / canvasHeight;
  camera.updateProjectionMatrix();

  // レンダラーのサイズを更新
  renderer.setSize(canvasWidth, canvasHeight);
}

// モデルのロード
function loadModels() {
  const loader = new GLTFLoader();

  // ケーキモデルのロード
  loader.load(
    cakeGLBPath,
    function (gltf) {
      let cakeMesh;
      gltf.scene.traverse(function (child) {
        if (child.isMesh) {
          cakeMesh = child;
        }
      });

      if (!cakeMesh) {
        console.error('ケーキモデルにメッシュが含まれていません');
        return;
      }

      cakeMesh.scale.set(10, 10, 10); // スケールを調整
      cakeMesh.position.set(0, 0, 0); // 位置を原点に設定
      cakeMesh.updateMatrixWorld(true); // 行列を更新

      cakeModel = cakeMesh;

      // ケーキを6等分
      sliceAndCreateCakePieces();

      gameState.isInitialized = true;

      // アリの生成を定期的に行う
      setInterval(createAnt, 3000);

      // ゲームループの開始
      animate();
    },
    undefined,
    function (error) {
      console.error('ケーキモデルの読み込みに失敗しました', error);
    }
  );

  // アリモデルのロード
  loader.load(
    antGLBPath,
    function (gltf) {
      let antMesh;
      gltf.scene.traverse(function (child) {
        if (child.isMesh) {
          antMesh = child;
        }
      });

      if (!antMesh) {
        console.error('アリモデルにメッシュが含まれていません');
        return;
      }

      antModels.push(antMesh);
    },
    undefined,
    function (error) {
      console.error('アリモデルの読み込みに失敗しました', error);
    }
  );
}

// ゲームループ
function animate() {
  if (gameState.gameOver) return;

  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // アリの移動と更新
  ants.forEach((ant) => {
    // ターゲットのケーキピースに向かって移動
    const targetPiece = cakePieces.find(
      (piece) => piece.id === ant.targetPieceId
    );

    if (!targetPiece) return;

    const direction = new THREE.Vector3()
      .subVectors(targetPiece.mesh.position, ant.mesh.position)
      .normalize();

    ant.mesh.position.add(direction.multiplyScalar(ant.speed * delta));

    // ターゲットに到達したかチェック
    const distance = ant.mesh.position.distanceTo(targetPiece.mesh.position);
    if (distance < 5) {
      // ケーキピースを削除
      scene.remove(targetPiece.mesh);
      cakePieces = cakePieces.filter((piece) => piece !== targetPiece);
      cakePiecesDisplay.textContent = cakePieces.length.toString();

      // アリを削除
      scene.remove(ant.mesh);
      ants = ants.filter((a) => a !== ant);

      // ケーキピースがなくなったらゲームオーバー
      if (cakePieces.length === 0) {
        gameOver();
      }
    }
  });

  renderer.render(scene, camera);
}

// ケーキピースの作成とスライス
function sliceAndCreateCakePieces() {
  console.log('スライス処理を開始');

  const numSlices = 6;

  // ケーキモデルが存在するか確認
  if (!cakeModel) {
    console.error('ケーキモデルが未定義です');
    return;
  }

  // ケーキモデルをCSGオブジェクトに変換
  const cakeCSG = CSG.fromMesh(cakeModel);

  for (let i = 0; i < numSlices; i++) {
    // スライス用の角度を計算
    const angleA = (i / numSlices) * Math.PI * 2;
    const angleB = ((i + 1) / numSlices) * Math.PI * 2;

    // 平面を定義
    const planeA = new THREE.Plane(
      new THREE.Vector3(Math.cos(angleA), 0, Math.sin(angleA)),
      0
    );
    const planeB = new THREE.Plane(
      new THREE.Vector3(-Math.cos(angleB), 0, -Math.sin(angleB)),
      0
    );

    // ケーキをスライス
    const sliceCSG = cakeCSG
      .cutByPlane(planeA)
      .cutByPlane(planeB);

    // メッシュに変換
    const sliceMesh = CSG.toMesh(sliceCSG, cakeModel.matrixWorld);
    sliceMesh.material = cakeModel.material.clone();

    // ピースをシーンに追加
    scene.add(sliceMesh);
    cakePieces.push({
      id: i,
      mesh: sliceMesh,
      position: sliceMesh.position.clone(),
    });
  }

  cakePiecesDisplay.textContent = cakePieces.length.toString();
  console.log('スライス処理が完了しました');
}

// アリの作成
function createAnt() {
  if (!gameState.isInitialized || antModels.length === 0) return;

  const antMesh = antModels[0].clone();
  const randomKanji =
    kanjiList[Math.floor(Math.random() * kanjiList.length)];

  const ant = {
    id: Math.random(),
    mesh: antMesh,
    reading: randomKanji.reading,
    targetPieceId:
      cakePieces[Math.floor(Math.random() * cakePieces.length)].id,
    speed: 20 + Math.random() * 10,
  };

  // アリの初期位置を設定
  const angle = Math.random() * Math.PI * 2;
  const distance = 200;
  ant.mesh.position.set(
    Math.cos(angle) * distance,
    0,
    Math.sin(angle) * distance
  );

  // アリの頭上に漢字を表示
  const canvas = document.createElement('canvas');
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.font = '100px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(randomKanji.kanji, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(20, 20, 1);
  sprite.position.set(0, 30, 0);
  ant.mesh.add(sprite);

  ant.mesh.scale.set(0.5, 0.5, 0.5);
  scene.add(ant.mesh);
  ants.push(ant);
}

// ユーザー入力の処理
function handleSubmit(event) {
  event.preventDefault();

  const userInput = inputField.value.trim().toLowerCase();

  // 読みが一致するアリを検索
  const matchingAnt = ants.find(
    (ant) => ant.reading === userInput
  );

  if (matchingAnt) {
    // アリを削除
    scene.remove(matchingAnt.mesh);
    ants = ants.filter((ant) => ant !== matchingAnt);

    // スコアを更新
    gameState.score += 10;
    scoreDisplay.textContent = gameState.score.toString();
  }

  // 入力フィールドをクリア
  inputField.value = '';
}

// ゲームオーバーの処理
function gameOver() {
  gameState.gameOver = true;
  finalScoreDisplay.textContent = gameState.score.toString();
  gameOverScreen.style.display = 'flex';
}

// ページ読み込み時にゲームを初期化
window.onload = init;
