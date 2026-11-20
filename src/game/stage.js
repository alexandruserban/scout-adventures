/**
 * Three.js scene, orthographic camera and WebGL renderer.
 * The camera always shows VIEW_WIDTH_PIXELS game pixels across; the visible height
 * follows the window's aspect ratio.
 */
(function (Forest) {
  const { PIXEL_SCALE, VIEW_WIDTH_PIXELS, CAMERA_REST_Y } = Forest.Config;

  const CAMERA_DISTANCE = 20;
  const NEAR_PLANE = 0.1;
  const FAR_PLANE = 100;

  class Stage {
    /** @param {HTMLElement} container element the canvas is added to */
    constructor(container) {
      this.viewWidthUnits = VIEW_WIDTH_PIXELS * PIXEL_SCALE;
      this.scene = new THREE.Scene();

      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR_PLANE, FAR_PLANE);
      this.camera.position.set(0, CAMERA_REST_Y, CAMERA_DISTANCE);
      this.camera.lookAt(0, CAMERA_REST_Y, 0);

      this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(1); // 1:1 pixels keep the art crisp
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      container.appendChild(this.renderer.domElement);

      this.fitToWindow();
      window.addEventListener('resize', () => this.fitToWindow());
    }

    fitToWindow() {
      const aspect = window.innerWidth / window.innerHeight;
      const viewHeightUnits = (VIEW_WIDTH_PIXELS / aspect) * PIXEL_SCALE;
      this.viewHeightUnits = viewHeightUnits;

      this.camera.left = -this.viewWidthUnits / 2;
      this.camera.right = this.viewWidthUnits / 2;
      this.camera.top = viewHeightUnits / 2;
      this.camera.bottom = -viewHeightUnits / 2;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
      this.renderer.render(this.scene, this.camera);
    }
  }

  Forest.Stage = Stage;
})(window.Forest);
