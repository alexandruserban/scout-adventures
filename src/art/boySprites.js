/**
 * Boy (player) sprite builder.
 *
 * Every frame of the hero is assembled at load time from the same upright parts:
 * one profile head (with expression variants), one straight torso, and limbs posed
 * by joint angles. Sharing parts keeps his face and proportions identical in every
 * frame, and posing limbs by angle makes the walk and the sword slam move smoothly.
 *
 * All parts are drawn facing right; the game mirrors the mesh to face left.
 */
(function (Forest) {
  const { PALETTE } = Forest;
  const { createPixelCanvas, drawAsciiArt, createWhiteSilhouette } = Forest.PixelCanvas;
  const { toRadians } = Forest.MathUtils;

  /** Regular frames are FRAME_SIZE x FRAME_SIZE pixels. */
  const FRAME_SIZE = 24;
  /** The row the soles of the boots rest on. */
  const FEET_ROW = FRAME_SIZE - 1;

  // ==========================================
  // Drawing primitives
  // ==========================================

  /** Plot one pixel. `color` is a palette key or a raw CSS colour. */
  function plot(ctx, x, y, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PALETTE[color] || color;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    ctx.globalAlpha = 1;
  }

  /** Line made of plotted pixels; thickness 2 doubles it one pixel to the right. */
  function drawLine(ctx, fromX, fromY, toX, toY, color, thickness = 1) {
    const length = Math.hypot(toX - fromX, toY - fromY);
    const steps = Math.max(1, Math.ceil(length * 3));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = fromX + (toX - fromX) * t;
      const y = fromY + (toY - fromY) * t;
      plot(ctx, x, y, color);
      if (thickness > 1) plot(ctx, x + 1, y, color);
    }
  }

  // ==========================================
  // Body parts (facing right)
  // ==========================================

  /** Left edge of the 12-pixel-wide head and torso. */
  const HEAD_X = 6;

  // Red cap with forward brim, brown hair at the back, one clear eye,
  // a small nose that sticks out, blush and a mouth.
  const HEADS = {
    normal: [
      '...ccccc....',
      '..cvvvcccc..',
      '.cccccccccCC',
      '.Hhhhjssss..',
      '.HhhSsssss..',
      '.HhhSssWEs..',
      '.HhhssssEss.',
      '..Hhsbbsss..',
      '...Hssssqs..',
      '....sssss...'
    ],
    hurt: [ // eye squeezed shut, mouth open
      '...ccccc....',
      '..cvvvcccc..',
      '.cccccccccCC',
      '.Hhhhjssss..',
      '.HhhSsssss..',
      '.HhhSsssss..',
      '.HhhsssEEss.',
      '..Hhsbbsss..',
      '...Hsssqqs..',
      '....sssss...'
    ],
    dazed: [ // wide eye, wobbly mouth
      '...ccccc....',
      '..cvvvcccc..',
      '.cccccccccCC',
      '.Hhhhjssss..',
      '.HhhSssWWs..',
      '.HhhSssWEs..',
      '.HhhsssEEss.',
      '..Hhsbbsss..',
      '...Hssqsqs..',
      '....sssss...'
    ],
    knockedOut: [ // X eye
      '...ccccc....',
      '..cvvvcccc..',
      '.cccccccccCC',
      '.Hhhhjssss..',
      '.HhhSssEsE..',
      '.HhhSsssEs..',
      '.HhhsssEsEs.',
      '..Hhsbbsss..',
      '...Hsssqqs..',
      '....sssss...'
    ]
  };

  /** Straight torso: scarf wrapped at the neck over a navy jacket. Occupies rows 10-15. */
  const TORSO = [
    '...FFfffF...',
    '..FFfffffF..',
    '..JkkkkklJ..',
    '..Jkkkkkll..',
    '..Jkkkkkkl..',
    '..JJJJJJJJ..'
  ];
  const TORSO_TOP_Y = 10;

  /** Belt line joining the legs. */
  const HIPS = ['.PPPPPP.'];
  const HIPS_X = 8;
  const HIPS_Y = 16;

  // Joint positions in the 24x24 frame, before the body is lowered onto its feet.
  // "Near" limbs are on the side facing the camera and are drawn on top.
  const HIP_NEAR = { x: 12, y: 16 };
  const HIP_FAR = { x: 10, y: 16 };
  const SHOULDER_NEAR = { x: 12, y: 11 };
  const SHOULDER_FAR = { x: 10, y: 11 };
  const THIGH_LENGTH = 3.5;
  const SHIN_LENGTH = 3.5;
  const ARM_LENGTH = 5;

  /**
   * Work out knee and ankle positions for a leg.
   * @param {{x:number,y:number}} hip
   * @param {number} thighAngle degrees from straight down (+ = forward)
   * @param {number} kneeBend degrees the shin swings back relative to the thigh
   */
  function solveLeg(hip, thighAngle, kneeBend) {
    const knee = {
      x: hip.x + Math.sin(toRadians(thighAngle)) * THIGH_LENGTH,
      y: hip.y + Math.cos(toRadians(thighAngle)) * THIGH_LENGTH
    };
    const shinAngle = thighAngle - kneeBend;
    const ankle = {
      x: knee.x + Math.sin(toRadians(shinAngle)) * SHIN_LENGTH,
      y: knee.y + Math.cos(toRadians(shinAngle)) * SHIN_LENGTH
    };
    return { hip, knee, ankle };
  }

  /** Lowest point of either ankle, used to stand the body on the bottom row. */
  function lowestAnkleY(nearLeg, farLeg) {
    return Math.round(Math.max(nearLeg.ankle.y, farLeg.ankle.y));
  }

  function drawLeg(ctx, leg, offsetX, offsetY, pantsColor) {
    drawLine(ctx, offsetX + leg.hip.x, offsetY + leg.hip.y, offsetX + leg.knee.x, offsetY + leg.knee.y, pantsColor, 2);
    drawLine(ctx, offsetX + leg.knee.x, offsetY + leg.knee.y, offsetX + leg.ankle.x, offsetY + leg.ankle.y, pantsColor, 2);

    // Boot: two-pixel shaft plus a toe pointing forward
    const ankleX = Math.round(offsetX + leg.ankle.x);
    const ankleY = Math.round(offsetY + leg.ankle.y);
    plot(ctx, ankleX, ankleY - 1, 'B');
    plot(ctx, ankleX + 1, ankleY - 1, 'd');
    plot(ctx, ankleX, ankleY, 'B');
    plot(ctx, ankleX + 1, ankleY, 'd');
    plot(ctx, ankleX + 2, ankleY, 'd');
  }

  /**
   * Straight arm from the shoulder with a hand at the end.
   * @param {number} angle degrees from straight down (+ = forward, 180 = straight up)
   * @param {boolean} isNearSide near arm is lighter and drawn over the body
   */
  function drawArm(ctx, shoulder, angle, offsetX, offsetY, isNearSide) {
    const startX = offsetX + shoulder.x;
    const startY = offsetY + shoulder.y;
    const handX = startX + Math.sin(toRadians(angle)) * ARM_LENGTH;
    const handY = startY + Math.cos(toRadians(angle)) * ARM_LENGTH;

    if (isNearSide) {
      drawLine(ctx, startX, startY, handX, handY, 'k', 2);
      drawLine(ctx, startX + 1, startY, handX + 1, handY, 'l', 1);
    } else {
      drawLine(ctx, startX, startY, handX, handY, 'J', 2);
    }
    plot(ctx, handX, handY + 1, 's');
    plot(ctx, handX + 1, handY + 1, isNearSide ? 's' : 'S');
  }

  /** Sword sheathed on the back: a short upright hilt peeks out behind the neck. */
  function drawSheathedSword(ctx, offsetX, offsetY) {
    plot(ctx, offsetX + 7, offsetY + 7, 'i');
    plot(ctx, offsetX + 7, offsetY + 8, 'o');
    plot(ctx, offsetX + 7, offsetY + 9, 'O');
    plot(ctx, offsetX + 6, offsetY + 10, 'i');
    plot(ctx, offsetX + 7, offsetY + 10, 'I');
    plot(ctx, offsetX + 8, offsetY + 10, 'i');
  }

  /**
   * Scarf tail from the back of the neck.
   * @param {'hang'|'wave'|'up'} style hanging when still, fluttering when moving, streaming up when falling
   * @param {number} phase animation phase for the 'wave' style
   */
  function drawScarfTail(ctx, offsetX, offsetY, style, phase) {
    const segmentCount = style === 'hang' ? 3 : 4;
    for (let i = 1; i <= segmentCount; i++) {
      let x;
      let y;
      if (style === 'up') {
        x = 8 - i;
        y = 11 - Math.round(i * 0.6);
      } else if (style === 'wave') {
        x = 8 - i;
        y = 11 + Math.round(i * 0.3 + Math.sin(phase + i * 1.3) * 0.7);
      } else {
        x = 8 - Math.ceil(i / 2);
        y = 11 + i;
      }
      plot(ctx, offsetX + x, offsetY + y, i % 2 ? 'F' : 'f');
      plot(ctx, offsetX + x, offsetY + y + 1, 'F');
    }
  }

  // ==========================================
  // Pose assembly
  // ==========================================

  /**
   * @typedef {object} Pose
   * @property {{near:[number,number], far:[number,number]}} legs [thighAngle, kneeBend] per leg
   * @property {{near:number, far:number}|null} [arms] arm angles; null hides the arms
   * @property {'normal'|'hurt'|'dazed'|'knockedOut'} [expression]
   * @property {'hang'|'wave'|'up'} [scarfStyle]
   * @property {number} [scarfPhase]
   * @property {boolean} [hasSheathedSword]
   * @property {number} [upperBodyShiftX] lean of head/torso/arms in pixels
   * @property {number} [upperBodyShiftY]
   * @property {boolean} [centered] centre vertically instead of standing on the bottom row (for spins)
   * @property {(ctx, x, y) => void} [drawExtras] extra details drawn last, relative to the upper body
   */

  /** Draw a full pose with its 24x24 box's top-left corner at (originX, originY). */
  function drawPose(ctx, pose, originX, originY) {
    const nearLeg = solveLeg(HIP_NEAR, pose.legs.near[0], pose.legs.near[1]);
    const farLeg = solveLeg(HIP_FAR, pose.legs.far[0], pose.legs.far[1]);

    // Lower the whole body so the lowest boot rests on the bottom row
    const gapBelowFeet = FEET_ROW - lowestAnkleY(nearLeg, farLeg);
    const bodyDrop = pose.centered ? Math.round(gapBelowFeet / 2) : gapBelowFeet;
    const legsY = originY + bodyDrop;
    const upperX = originX + (pose.upperBodyShiftX || 0);
    const upperY = legsY + (pose.upperBodyShiftY || 0);

    // Back to front
    if (pose.hasSheathedSword) drawSheathedSword(ctx, upperX, upperY);
    drawScarfTail(ctx, upperX, upperY, pose.scarfStyle || 'hang', pose.scarfPhase || 0);
    if (pose.arms) drawArm(ctx, SHOULDER_FAR, pose.arms.far, upperX, upperY, false);
    drawLeg(ctx, farLeg, originX, legsY, 'P');
    drawLeg(ctx, nearLeg, originX, legsY, 'p');
    drawAsciiArt(ctx, HIPS, originX + HIPS_X, legsY + HIPS_Y);
    drawAsciiArt(ctx, TORSO, upperX + HEAD_X, upperY + TORSO_TOP_Y);
    drawAsciiArt(ctx, HEADS[pose.expression || 'normal'], upperX + HEAD_X, upperY);
    if (pose.arms) drawArm(ctx, SHOULDER_NEAR, pose.arms.near, upperX, upperY, true);
    if (pose.drawExtras) pose.drawExtras(ctx, upperX, upperY);
  }

  /** Render a pose into its own 24x24 canvas. */
  function renderPose(pose) {
    const { canvas, ctx } = createPixelCanvas(FRAME_SIZE, FRAME_SIZE);
    drawPose(ctx, pose, 0, 0);
    return canvas;
  }

  // ==========================================
  // Regular frames (24x24)
  // ==========================================

  const idle = [
    renderPose({ legs: { near: [6, 0], far: [-6, 0] }, arms: { near: 8, far: -6 }, hasSheathedSword: true }),
    renderPose({ legs: { near: [6, 0], far: [-6, 0] }, arms: { near: 10, far: -4 }, hasSheathedSword: true, upperBodyShiftY: 1 })
  ];

  // 8-frame walk: legs follow a sine stride, knees bend while swinging forward,
  // arms swing opposite the legs, and the scarf flutters.
  const WALK_FRAME_COUNT = 8;

  function walkLegAngles(phase) {
    const forwardSwing = Math.cos(phase);
    const thighAngle = 28 * Math.sin(phase);
    const kneeBend = forwardSwing > 0 ? 55 * forwardSwing : 8 * -forwardSwing;
    return [thighAngle, kneeBend];
  }

  const walk = [];
  for (let i = 0; i < WALK_FRAME_COUNT; i++) {
    const phase = (i / WALK_FRAME_COUNT) * Math.PI * 2;
    walk.push(renderPose({
      legs: { near: walkLegAngles(phase), far: walkLegAngles(phase + Math.PI) },
      arms: { near: -28 * Math.sin(phase), far: 28 * Math.sin(phase) },
      scarfStyle: 'wave',
      scarfPhase: phase,
      hasSheathedSword: true
    }));
  }

  // Jump arc: crouch (take-off / landing) -> rise -> apex tuck -> fall, plus a tucked ball for the double-jump spin
  const crouch = renderPose({ // knees bent, body low, arms down ready to swing
    legs: { near: [40, 80], far: [-10, 60] }, arms: { near: 25, far: 5 }, scarfStyle: 'hang', hasSheathedSword: true
  });
  const jumpRise = renderPose({ // stretched upward, back leg trailing, arms thrown up
    legs: { near: [5, 5], far: [-25, 35] }, arms: { near: 118, far: 150 }, scarfStyle: 'hang', hasSheathedSword: true
  });
  const jumpApex = renderPose({ // knees pulled up at the top of the arc
    legs: { near: [45, 90], far: [20, 70] }, arms: { near: 110, far: 90 }, scarfStyle: 'wave', scarfPhase: 1, hasSheathedSword: true
  });
  const fall = renderPose({ // legs reaching for the ground, arms up for balance, scarf streaming up
    legs: { near: [18, 25], far: [-12, 10] }, arms: { near: 95, far: 130 }, scarfStyle: 'up', hasSheathedSword: true
  });
  const jumpSpin = renderPose({ // tight ball, centred so it spins around its middle
    legs: { near: [85, 160], far: [75, 150] }, arms: { near: 75, far: 55 }, scarfStyle: 'wave', hasSheathedSword: true, centered: true
  });

  const hitRecoil = renderPose({
    expression: 'hurt', upperBodyShiftX: -1,
    legs: { near: [22, 10], far: [-18, 0] }, arms: { near: 70, far: 45 }, scarfStyle: 'up', hasSheathedSword: true
  });
  const hitStagger = renderPose({
    expression: 'dazed', upperBodyShiftY: 1,
    legs: { near: [-8, 30], far: [16, 20] }, arms: { near: 20, far: -20 }, scarfStyle: 'hang', hasSheathedSword: true,
    drawExtras: (ctx, x, y) => { // little sweat drop
      plot(ctx, x + 19, y + 2, 'W');
      plot(ctx, x + 19, y + 3, 'W');
      plot(ctx, x + 20, y + 3, 'W');
    }
  });

  /** Defeated: a limp standing pose rotated onto his back, then dropped to the ground. */
  function renderDefeated() {
    const standing = renderPose({
      expression: 'knockedOut', legs: { near: [4, 0], far: [-4, 0] }, arms: { near: 170, far: 160 }, scarfStyle: 'hang'
    });

    const rotated = createPixelCanvas(FRAME_SIZE, FRAME_SIZE);
    rotated.ctx.translate(0, FRAME_SIZE);
    rotated.ctx.rotate(-Math.PI / 2);
    rotated.ctx.drawImage(standing, 0, 0);

    // Find the lowest painted row so the body can rest on the bottom row
    const alpha = rotated.ctx.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE).data;
    let lowestPaintedRow = 0;
    for (let y = 0; y < FRAME_SIZE; y++) {
      for (let x = 0; x < FRAME_SIZE; x++) {
        if (alpha[(y * FRAME_SIZE + x) * 4 + 3] > 0) lowestPaintedRow = y;
      }
    }

    const result = createPixelCanvas(FRAME_SIZE, FRAME_SIZE);
    result.ctx.drawImage(rotated.canvas, 0, FEET_ROW - lowestPaintedRow);
    return result.canvas;
  }

  // ==========================================
  // Overhead sword slam (48x44 frames)
  // The sword reaches far outside the 24x24 box, so slam frames use a bigger canvas.
  // The body's 24x24 box sits at SLAM_BODY_ORIGIN inside it.
  // ==========================================
  const SLAM_CANVAS_SIZE = { width: 48, height: 44 };
  const SLAM_BODY_ORIGIN = { x: 8, y: 20 };
  const BLADE_LENGTH = 13;
  /** Distance from the hands to the first blade pixel. */
  const BLADE_START = 2.5;
  /** Distance from the hands to the crossguard. */
  const CROSSGUARD_DISTANCE = 1.8;

  const SLAM_STANCES = {
    stand: { near: [8, 0], far: [-8, 0] },
    lunge: { near: [32, 45], far: [-30, 0] },
    // Mid-air: knees tucked up, back leg trailing
    airTuck: { near: [40, 75], far: [-15, 45] },
    airExtend: { near: [20, 30], far: [-30, 20] }
  };

  // Blade layers drawn in order: shadow side, core, then the bright cutting edge on top
  const BLADE_LAYERS = [
    { color: '-', edgeOffset: -1, length: BLADE_LENGTH - 3 },
    { color: '+', edgeOffset: 0, length: BLADE_LENGTH },
    { color: '*', edgeOffset: 1, length: BLADE_LENGTH - 1 }
  ];

  /**
   * Keyframes of the slam: lift -> raise -> wind-up hold -> fast downswing -> IMPACT -> recover.
   *  bladeAngle   blade direction in degrees (0 = forward, 90 = straight up, 180 = behind)
   *  handAngle    where the hands sit around the near shoulder (0 = forward, 90 = up)
   *  handReach    distance from shoulder to hands, in pixels
   *  bodyShiftX   lean of the upper body, in pixels
   *  duration     seconds the frame is shown
   *  smearFrom    blade angle the motion smear starts at (fast frames only)
   *  playsSwoosh  play the swing sound when this frame starts
   *  isImpact     the blade hits the ground: deal damage on this frame
   */
  const SLAM_KEYFRAMES = [
    { name: 'Lift', bladeAngle: 15, handAngle: -25, handReach: 6, bodyShiftX: 0, stance: 'stand', duration: 0.025 },
    { name: 'Raise', bladeAngle: 60, handAngle: 10, handReach: 7, bodyShiftX: 0, stance: 'stand', duration: 0.025 },
    { name: 'Raise', bladeAngle: 100, handAngle: 40, handReach: 9, bodyShiftX: -1, stance: 'stand', duration: 0.03 },
    { name: 'Overhead', bladeAngle: 125, handAngle: 45, handReach: 12, bodyShiftX: -1, stance: 'stand', duration: 0.035 },
    { name: 'Wind-up', bladeAngle: 140, handAngle: 48, handReach: 12, bodyShiftX: -1, stance: 'stand', duration: 0.05 },
    { name: 'Downswing', bladeAngle: 85, handAngle: 35, handReach: 10, bodyShiftX: 0, stance: 'stand', duration: 0.025, smearFrom: 140, playsSwoosh: true },
    { name: 'Downswing', bladeAngle: 30, handAngle: 5, handReach: 8, bodyShiftX: 1, stance: 'lunge', duration: 0.025, smearFrom: 85 },
    { name: 'IMPACT', bladeAngle: -30, handAngle: -35, handReach: 7, bodyShiftX: 1, stance: 'lunge', duration: 0.08, smearFrom: 30, isImpact: true },
    { name: 'Settle', bladeAngle: -32, handAngle: -38, handReach: 7, bodyShiftX: 1, stance: 'lunge', duration: 0.05 },
    { name: 'Recover', bladeAngle: -5, handAngle: -30, handReach: 6, bodyShiftX: 0, stance: 'stand', duration: 0.04 },
    { name: 'Recover', bladeAngle: 15, handAngle: -25, handReach: 6, bodyShiftX: 0, stance: 'stand', duration: 0.03 }
  ];

  /**
   * Keyframes of the mid-air slash: a quick horizontal sweep from behind the shoulder to straight ahead.
   * Same fields as SLAM_KEYFRAMES; `isImpact` marks the frame that deals damage (the blade is level).
   */
  const AIR_SLASH_KEYFRAMES = [
    { name: 'Air: Draw', bladeAngle: 165, handAngle: 140, handReach: 5, bodyShiftX: -1, stance: 'airTuck', duration: 0.045 },
    { name: 'Air: Swing', bladeAngle: 80, handAngle: 60, handReach: 7, bodyShiftX: 0, stance: 'airTuck', duration: 0.025, smearFrom: 165, playsSwoosh: true },
    { name: 'Air: SLASH', bladeAngle: 0, handAngle: 5, handReach: 9, bodyShiftX: 1, stance: 'airExtend', duration: 0.08, smearFrom: 80, isImpact: true },
    { name: 'Air: Follow', bladeAngle: -20, handAngle: -15, handReach: 8, bodyShiftX: 1, stance: 'airExtend', duration: 0.06 },
    { name: 'Air: Recover', bladeAngle: 10, handAngle: -20, handReach: 6, bodyShiftX: 0, stance: 'airTuck', duration: 0.06 }
  ];

  /** Unit vector for an angle in degrees, with y pointing down the canvas. */
  function directionFromAngle(degrees) {
    return { x: Math.cos(toRadians(degrees)), y: -Math.sin(toRadians(degrees)) };
  }

  /**
   * @returns {{name, canvas, duration, playsSwoosh, isImpact, bladeTip}}
   *   bladeTip is in body-local pixels (24x24 box, y down) and positions the impact effects.
   */
  function renderSlamFrame(keyframe) {
    const { canvas, ctx } = createPixelCanvas(SLAM_CANVAS_SIZE.width, SLAM_CANVAS_SIZE.height);
    // All coordinates below are relative to the body's 24x24 box
    const plotAt = (x, y, color, alpha) => plot(ctx, SLAM_BODY_ORIGIN.x + x, SLAM_BODY_ORIGIN.y + y, color, alpha);

    // Where the shoulders end up once the body stands on the chosen stance
    const legs = SLAM_STANCES[keyframe.stance];
    const nearLeg = solveLeg(HIP_NEAR, legs.near[0], legs.near[1]);
    const farLeg = solveLeg(HIP_FAR, legs.far[0], legs.far[1]);
    const bodyDrop = FEET_ROW - lowestAnkleY(nearLeg, farLeg);
    const nearShoulder = { x: SHOULDER_NEAR.x + keyframe.bodyShiftX, y: SHOULDER_NEAR.y + bodyDrop };
    const farShoulder = { x: SHOULDER_FAR.x + keyframe.bodyShiftX, y: SHOULDER_FAR.y + bodyDrop };

    const handDirection = directionFromAngle(keyframe.handAngle);
    const hands = {
      x: nearShoulder.x + handDirection.x * keyframe.handReach,
      y: nearShoulder.y + handDirection.y * keyframe.handReach
    };
    const bladeDirection = directionFromAngle(keyframe.bladeAngle);
    const edgeDirection = directionFromAngle(keyframe.bladeAngle - 90); // points to the cutting side

    if (keyframe.smearFrom !== undefined) {
      drawSwingSmear(plotAt, hands, keyframe.smearFrom, keyframe.bladeAngle);
    }
    drawBlade(plotAt, hands, bladeDirection, edgeDirection);

    // Far arm reaches the grip from behind the body
    drawLine(
      ctx,
      SLAM_BODY_ORIGIN.x + farShoulder.x, SLAM_BODY_ORIGIN.y + farShoulder.y,
      SLAM_BODY_ORIGIN.x + hands.x, SLAM_BODY_ORIGIN.y + hands.y,
      'J', 2
    );

    // Body without arms or the sheathed sword (it's in his hands now)
    drawPose(ctx, {
      legs,
      arms: null,
      scarfStyle: keyframe.smearFrom !== undefined ? 'up' : 'hang',
      upperBodyShiftX: keyframe.bodyShiftX
    }, SLAM_BODY_ORIGIN.x, SLAM_BODY_ORIGIN.y);

    drawNearArm(plotAt, nearShoulder, hands);
    drawGripAndHands(plotAt, hands, bladeDirection);

    const tipDistance = BLADE_START + BLADE_LENGTH;
    return {
      name: keyframe.name,
      canvas,
      duration: keyframe.duration,
      playsSwoosh: !!keyframe.playsSwoosh,
      isImpact: !!keyframe.isImpact,
      bladeTip: {
        x: hands.x + bladeDirection.x * tipDistance,
        y: hands.y + bladeDirection.y * tipDistance
      }
    };
  }

  /** Fading arc behind the blade on fast frames; brighter towards the end of the swing and at the tip. */
  function drawSwingSmear(plotAt, hands, fromAngle, toAngle) {
    const steps = Math.ceil(Math.abs(fromAngle - toAngle) / 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = toRadians(fromAngle + (toAngle - fromAngle) * t);
      for (let radius = 6; radius <= BLADE_LENGTH + 2; radius += 0.5) {
        const isNearTip = radius > BLADE_LENGTH - 1;
        const alpha = (0.12 + 0.6 * t) * (isNearTip ? 1 : 0.7);
        plotAt(
          hands.x + Math.cos(angle) * radius,
          hands.y - Math.sin(angle) * radius,
          isNearTip ? 'W' : 'L',
          alpha
        );
      }
    }
  }

  function drawBlade(plotAt, hands, bladeDirection, edgeDirection) {
    BLADE_LAYERS.forEach(({ color, edgeOffset, length }) => {
      for (let distance = BLADE_START; distance <= BLADE_START + length; distance += 0.35) {
        plotAt(
          hands.x + bladeDirection.x * distance + edgeDirection.x * edgeOffset,
          hands.y + bladeDirection.y * distance + edgeDirection.y * edgeOffset,
          color
        );
      }
    });

    // Crossguard, with a highlight in the middle
    const guardX = hands.x + bladeDirection.x * CROSSGUARD_DISTANCE;
    const guardY = hands.y + bladeDirection.y * CROSSGUARD_DISTANCE;
    for (let offset = -2; offset <= 2; offset += 0.5) {
      plotAt(guardX + edgeDirection.x * offset, guardY + edgeDirection.y * offset, Math.abs(offset) < 0.6 ? 'I' : 'i');
    }
  }

  /** Two-tone sleeve from the near shoulder to the hands. */
  function drawNearArm(plotAt, shoulder, hands) {
    const deltaX = hands.x - shoulder.x;
    const deltaY = hands.y - shoulder.y;
    const length = Math.hypot(deltaX, deltaY) || 1;
    const perpendicular = { x: -deltaY / length, y: deltaX / length };
    for (let t = 0; t <= 1; t += 0.5 / length) {
      const x = shoulder.x + deltaX * t;
      const y = shoulder.y + deltaY * t;
      plotAt(x + perpendicular.x * 0.5, y + perpendicular.y * 0.5, 'k');
      plotAt(x - perpendicular.x * 0.5, y - perpendicular.y * 0.5, 'l');
    }
  }

  function drawGripAndHands(plotAt, hands, bladeDirection) {
    for (let offset = -1; offset <= 1; offset += 0.5) {
      plotAt(hands.x + bladeDirection.x * offset, hands.y + bladeDirection.y * offset, 'o');
    }
    plotAt(hands.x, hands.y, 's');
    plotAt(hands.x + 1, hands.y, 's');
    plotAt(hands.x, hands.y + 1, 'S');
    plotAt(hands.x + 1, hands.y + 1, 'S');
    // Pommel
    plotAt(hands.x - bladeDirection.x * 2, hands.y - bladeDirection.y * 2, 'i');
  }

  Forest.BoySprites = Object.freeze({
    FRAME_SIZE,
    idle,
    walk,
    crouch,
    jumpRise,
    jumpApex,
    fall,
    jumpSpin,
    hitRecoil,
    hitRecoilFlash: createWhiteSilhouette(hitRecoil),
    hitStagger,
    defeated: renderDefeated(),
    slam: SLAM_KEYFRAMES.map(renderSlamFrame),
    airSlash: AIR_SLASH_KEYFRAMES.map(renderSlamFrame),
    SLAM_CANVAS_SIZE,
    SLAM_BODY_ORIGIN
  });
})(window.Forest);
