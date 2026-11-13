// Boy Character Builder
// Every frame of the hero is assembled at load time from the same upright parts:
// one profile head (with expression variants), one straight torso, and limbs posed
// by joint angles. Sharing parts keeps his face and proportions identical in every
// frame, and posing limbs by angle makes the walk and the sword slam move smoothly.

(function () {
  const P = window.SpriteData.PALETTE;

  // ==========================================
  // Canvas helpers
  // ==========================================
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { c, ctx };
  }

  function drawRows(ctx, rows, ox, oy) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const col = P[row[x]];
        if (col && col !== 'transparent') {
          ctx.fillStyle = col;
          ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
    }
  }

  function px(ctx, x, y, key, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = P[key] || key;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    ctx.globalAlpha = 1;
  }

  function line(ctx, x0, y0, x1, y1, key, width) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * 3));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      px(ctx, x, y, key);
      if (width > 1) px(ctx, x + 1, y, key);
    }
  }

  const rad = d => (d * Math.PI) / 180;

  // ==========================================
  // Parts (facing right). Head is 12 wide, placed at HEAD_X.
  // ==========================================
  const HEAD_X = 6;

  // Red cap with forward brim, brown hair at the back, one clear eye,
  // a small nose that sticks out, blush and a mouth.
  const HEADS = {
    normal: [
      "...ccccc....",
      "..cvvvcccc..",
      ".cccccccccCC",
      ".Hhhhjssss..",
      ".HhhSsssss..",
      ".HhhSssWEs..",
      ".HhhssssEss.",
      "..Hhsbbsss..",
      "...Hssssqs..",
      "....sssss..."
    ],
    hurt: [ // eye squeezed shut, mouth open
      "...ccccc....",
      "..cvvvcccc..",
      ".cccccccccCC",
      ".Hhhhjssss..",
      ".HhhSsssss..",
      ".HhhSsssss..",
      ".HhhsssEEss.",
      "..Hhsbbsss..",
      "...Hsssqqs..",
      "....sssss..."
    ],
    dazed: [ // wide eye, wobbly mouth
      "...ccccc....",
      "..cvvvcccc..",
      ".cccccccccCC",
      ".Hhhhjssss..",
      ".HhhSssWWs..",
      ".HhhSssWEs..",
      ".HhhsssEEss.",
      "..Hhsbbsss..",
      "...Hssqsqs..",
      "....sssss..."
    ],
    ko: [ // X eye
      "...ccccc....",
      "..cvvvcccc..",
      ".cccccccccCC",
      ".Hhhhjssss..",
      ".HhhSssEsE..",
      ".HhhSsssEs..",
      ".HhhsssEsEs.",
      "..Hhsbbsss..",
      "...Hsssqqs..",
      "....sssss..."
    ]
  };

  // Straight torso: scarf wrapped at the neck, navy jacket, rows 10-15
  const TORSO = [
    "...FFfffF...",
    "..FFfffffF..",
    "..JkkkkklJ..",
    "..Jkkkkkll..",
    "..Jkkkkkkl..",
    "..JJJJJJJJ.."
  ];
  const HIPS = ".PPPPPP."; // row 16, at x = 9

  // Joint positions (24x24 frame, before the body is lowered onto the feet)
  const HIP_NEAR = { x: 12, y: 16 };
  const HIP_FAR = { x: 10, y: 16 };
  const SHOULDER_NEAR = { x: 12, y: 11 };
  const SHOULDER_FAR = { x: 10, y: 11 };
  const THIGH = 3.5, SHIN = 3.5, ARM = 5;

  // a = thigh angle from straight down (+ = forward), bend = knee bend (shin swings back)
  function legPoints(hip, a, bend) {
    const knee = { x: hip.x + Math.sin(rad(a)) * THIGH, y: hip.y + Math.cos(rad(a)) * THIGH };
    const s = a - bend;
    const ankle = { x: knee.x + Math.sin(rad(s)) * SHIN, y: knee.y + Math.cos(rad(s)) * SHIN };
    return { hip, knee, ankle };
  }

  function drawLeg(ctx, L, ox, oy, pants) {
    line(ctx, ox + L.hip.x, oy + L.hip.y, ox + L.knee.x, oy + L.knee.y, pants, 2);
    line(ctx, ox + L.knee.x, oy + L.knee.y, ox + L.ankle.x, oy + L.ankle.y, pants, 2);
    // Boot: two-pixel shaft plus a toe pointing forward
    const ax = Math.round(ox + L.ankle.x), ay = Math.round(oy + L.ankle.y);
    px(ctx, ax, ay - 1, 'B'); px(ctx, ax + 1, ay - 1, 'd');
    px(ctx, ax, ay, 'B'); px(ctx, ax + 1, ay, 'd'); px(ctx, ax + 2, ay, 'd');
  }

  // angle from straight down (+ = forward, 180 = straight up)
  function drawArm(ctx, sh, angle, ox, oy, near) {
    const hx = sh.x + Math.sin(rad(angle)) * ARM;
    const hy = sh.y + Math.cos(rad(angle)) * ARM;
    if (near) {
      line(ctx, ox + sh.x, oy + sh.y, ox + hx, oy + hy, 'k', 2);
      line(ctx, ox + sh.x + 1, oy + sh.y, ox + hx + 1, oy + hy, 'l', 1);
    } else {
      line(ctx, ox + sh.x, oy + sh.y, ox + hx, oy + hy, 'J', 2);
    }
    px(ctx, ox + hx, oy + hy + 1, 's');
    px(ctx, ox + hx + 1, oy + hy + 1, near ? 's' : 'S');
  }

  // Sword sheathed on the back: a short upright hilt peeks out behind the neck
  function drawBackSword(ctx, ox, oy) {
    px(ctx, ox + 7, oy + 7, 'i');
    px(ctx, ox + 7, oy + 8, 'o');
    px(ctx, ox + 7, oy + 9, 'O');
    px(ctx, ox + 6, oy + 10, 'i'); px(ctx, ox + 7, oy + 10, 'I'); px(ctx, ox + 8, oy + 10, 'i');
  }

  // Scarf tail from the back of the neck: short and close to the body when still,
  // fluttering behind him when moving, streaming upward when falling
  function drawScarfTail(ctx, ox, oy, mode, phase) {
    const n = mode === 'hang' ? 3 : 4;
    for (let i = 1; i <= n; i++) {
      let x, y;
      if (mode === 'up') { x = 8 - i; y = 11 - Math.round(i * 0.6); }
      else if (mode === 'wave') { x = 8 - i; y = 11 + Math.round(i * 0.3 + Math.sin(phase + i * 1.3) * 0.7); }
      else { x = 8 - Math.ceil(i / 2); y = 11 + i; } // hanging
      px(ctx, ox + x, oy + y, i % 2 ? 'F' : 'f');
      px(ctx, ox + x, oy + y + 1, 'F');
    }
  }

  // ==========================================
  // Pose assembly
  // ==========================================
  // pose: { head, legs: {near:[a,bend], far:[a,bend]}, arms: {near, far} | null,
  //         scarf, phase, sword: 'back' | null, upperDx, upperDy, extra(ctx, ox, oy) }
  function drawPose(ctx, pose, ox, oy) {
    const near = legPoints(HIP_NEAR, pose.legs.near[0], pose.legs.near[1]);
    const far = legPoints(HIP_FAR, pose.legs.far[0], pose.legs.far[1]);
    // Lower the whole body so the lowest boot rests on row 23
    // (or centre it vertically, for poses that spin around the sprite centre)
    const gap = 23 - Math.round(Math.max(near.ankle.y, far.ankle.y));
    const drop = pose.center ? Math.round(gap / 2) : gap;
    const by = oy + drop;
    const ux = ox + (pose.upperDx || 0);
    const uy = by + (pose.upperDy || 0);

    if (pose.sword === 'back') drawBackSword(ctx, ux, uy);
    drawScarfTail(ctx, ux, uy, pose.scarf || 'hang', pose.phase || 0);
    if (pose.arms) drawArm(ctx, SHOULDER_FAR, pose.arms.far, ux, uy, false);
    drawLeg(ctx, far, ox, by, 'P');
    drawLeg(ctx, near, ox, by, 'p');
    drawRows(ctx, [HIPS], ox + 8, by + 16);
    drawRows(ctx, TORSO, ux + HEAD_X, uy + 10);
    drawRows(ctx, HEADS[pose.head || 'normal'], ux + HEAD_X, uy);
    if (pose.arms) drawArm(ctx, SHOULDER_NEAR, pose.arms.near, ux, uy, true);
    if (pose.extra) pose.extra(ctx, ux, uy);
    return { dx: ux - ox, dy: uy - oy };
  }

  function poseFrame(pose) {
    const { c, ctx } = makeCanvas(24, 24);
    drawPose(ctx, pose, 0, 0);
    return c;
  }

  // White silhouette used for the hit flash
  function flashOf(src) {
    const { c, ctx } = makeCanvas(src.width, src.height);
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ==========================================
  // Frames
  // ==========================================
  const IDLE = [
    poseFrame({ legs: { near: [6, 0], far: [-6, 0] }, arms: { near: 8, far: -6 }, sword: 'back' }),
    poseFrame({ legs: { near: [6, 0], far: [-6, 0] }, arms: { near: 10, far: -4 }, sword: 'back', upperDy: 1 })
  ];

  // 8-frame walk: legs follow a sine stride, knees bend while swinging forward,
  // arms swing opposite the legs, and the body bobs as the feet pass.
  const WALK = [];
  for (let i = 0; i < 8; i++) {
    const p = (i / 8) * Math.PI * 2;
    const leg = ph => [28 * Math.sin(ph), Math.cos(ph) > 0 ? 55 * Math.cos(ph) : 8 * -Math.cos(ph)];
    WALK.push(poseFrame({
      legs: { near: leg(p), far: leg(p + Math.PI) },
      arms: { near: -28 * Math.sin(p), far: 28 * Math.sin(p) },
      scarf: 'wave', phase: p, sword: 'back'
    }));
  }

  // Jump arc: crouch (take-off / landing) -> rise -> apex tuck -> fall, plus a tucked ball for the double-jump spin
  const JUMP_CROUCH = poseFrame({ // knees bent, body low, arms down ready to swing
    legs: { near: [40, 80], far: [-10, 60] }, arms: { near: 25, far: 5 }, scarf: 'hang', sword: 'back'
  });
  const JUMP_RISE = poseFrame({ // stretched upward, back leg trailing, arms thrown up
    legs: { near: [5, 5], far: [-25, 35] }, arms: { near: 118, far: 150 }, scarf: 'hang', sword: 'back'
  });
  const JUMP_APEX = poseFrame({ // knees pulled up at the top of the arc
    legs: { near: [45, 90], far: [20, 70] }, arms: { near: 110, far: 90 }, scarf: 'wave', phase: 1, sword: 'back'
  });
  const FALL = poseFrame({ // legs reaching for the ground, arms up for balance, scarf streaming up
    legs: { near: [18, 25], far: [-12, 10] }, arms: { near: 95, far: 130 }, scarf: 'up', sword: 'back'
  });
  const JUMP_SPIN = poseFrame({ // tight ball, centred so it spins around its middle
    legs: { near: [85, 160], far: [75, 150] }, arms: { near: 75, far: 55 }, scarf: 'wave', sword: 'back', center: true
  });
  const HIT_1 = poseFrame({
    head: 'hurt', upperDx: -1,
    legs: { near: [22, 10], far: [-18, 0] }, arms: { near: 70, far: 45 }, scarf: 'up', sword: 'back'
  });
  const HIT_2 = poseFrame({
    head: 'dazed', upperDy: 1,
    legs: { near: [-8, 30], far: [16, 20] }, arms: { near: 20, far: -20 }, scarf: 'hang', sword: 'back',
    extra: (ctx, ox, oy) => { px(ctx, ox + 19, oy + 2, 'W'); px(ctx, ox + 19, oy + 3, 'W'); px(ctx, ox + 20, oy + 3, 'W'); }
  });

  // Defeated: a limp standing pose rotated onto his back, then dropped to the ground
  const DEFEATED = (function () {
    const stand = poseFrame({ head: 'ko', legs: { near: [4, 0], far: [-4, 0] }, arms: { near: 170, far: 160 }, scarf: 'hang' });
    const rot = makeCanvas(24, 24);
    rot.ctx.translate(0, 24);
    rot.ctx.rotate(-Math.PI / 2);
    rot.ctx.drawImage(stand, 0, 0);
    // find the lowest painted row and rest it on row 23
    const data = rot.ctx.getImageData(0, 0, 24, 24).data;
    let maxY = 0;
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (data[(y * 24 + x) * 4 + 3] > 0) maxY = y;
    const out = makeCanvas(24, 24);
    out.ctx.drawImage(rot.c, 0, 23 - maxY);
    return out.c;
  })();

  // ==========================================
  // OVERHEAD SLAM ATTACK (48x44 canvas)
  // Body sits at ORIGIN so its 24x24 box lines up with the normal sprite.
  // ==========================================
  const W = 48, H = 44;
  const ORIGIN = { x: 8, y: 20 };
  const BLADE_LEN = 13;

  const STANCE = { stand: { near: [8, 0], far: [-8, 0] }, lunge: { near: [32, 45], far: [-30, 0] } };

  // theta: blade direction (0 = forward, 90 = straight up, 180 = behind)
  // phi/reach: where the hands sit around the near shoulder (0 = forward, 90 = up)
  const KEYS = [
    { theta: 15,  phi: -25, reach: 6,  dx: 0,  legs: 'stand', dur: 0.04 },               // lift
    { theta: 60,  phi: 10,  reach: 7,  dx: 0,  legs: 'stand', dur: 0.04 },               // raise
    { theta: 100, phi: 40,  reach: 9,  dx: -1, legs: 'stand', dur: 0.04 },               // raise
    { theta: 125, phi: 45,  reach: 12, dx: -1, legs: 'stand', dur: 0.05 },               // overhead
    { theta: 140, phi: 48,  reach: 12, dx: -1, legs: 'stand', dur: 0.09, peak: true },   // wind-up hold
    { theta: 85,  phi: 35,  reach: 10, dx: 0,  legs: 'stand', dur: 0.03, smearFrom: 140, swing: true },
    { theta: 30,  phi: 5,   reach: 8,  dx: 1,  legs: 'lunge', dur: 0.03, smearFrom: 85 },
    { theta: -30, phi: -35, reach: 7,  dx: 1,  legs: 'lunge', dur: 0.11, smearFrom: 30, hit: true }, // IMPACT
    { theta: -32, phi: -38, reach: 7,  dx: 1,  legs: 'lunge', dur: 0.08 },               // settle
    { theta: -5,  phi: -30, reach: 6,  dx: 0,  legs: 'stand', dur: 0.06 },               // recover
    { theta: 15,  phi: -25, reach: 6,  dx: 0,  legs: 'stand', dur: 0.05 }                // recover
  ];

  function attackFrame(k) {
    const { c, ctx } = makeCanvas(W, H);
    const ox = ORIGIN.x, oy = ORIGIN.y;

    // Where the body ends up after leaning and settling onto the stance
    const legs = STANCE[k.legs];
    const nearL = legPoints(HIP_NEAR, legs.near[0], legs.near[1]);
    const farL = legPoints(HIP_FAR, legs.far[0], legs.far[1]);
    const drop = 23 - Math.round(Math.max(nearL.ankle.y, farL.ankle.y));

    const sh = { x: SHOULDER_NEAR.x + k.dx, y: SHOULDER_NEAR.y + drop };
    const shFar = { x: SHOULDER_FAR.x + k.dx, y: SHOULDER_FAR.y + drop };
    const hand = {
      x: sh.x + Math.cos(rad(k.phi)) * k.reach,
      y: sh.y - Math.sin(rad(k.phi)) * k.reach
    };
    const d = { x: Math.cos(rad(k.theta)), y: -Math.sin(rad(k.theta)) };
    const edge = { x: Math.cos(rad(k.theta - 90)), y: -Math.sin(rad(k.theta - 90)) }; // cutting side

    // Motion smear arc behind the blade on fast frames
    if (k.smearFrom != null) {
      const from = k.smearFrom, to = k.theta;
      const steps = Math.ceil(Math.abs(from - to) / 2);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = rad(from + (to - from) * t);
        for (let r = 6; r <= BLADE_LEN + 2; r += 0.5) {
          const alpha = (0.12 + 0.6 * t) * (r > BLADE_LEN - 1 ? 1 : 0.7);
          px(ctx, ox + hand.x + Math.cos(a) * r, oy + hand.y - Math.sin(a) * r, r > BLADE_LEN - 1 ? 'W' : 'L', alpha);
        }
      }
    }

    // Blade: shadow side, core, then bright cutting edge on top
    const bladeStart = 2.5;
    [['-', -1, BLADE_LEN - 3], ['+', 0, BLADE_LEN], ['*', 1, BLADE_LEN - 1]].forEach(([key, side, len]) => {
      for (let s = bladeStart; s <= bladeStart + len; s += 0.35) {
        px(ctx, ox + hand.x + d.x * s + edge.x * side, oy + hand.y + d.y * s + edge.y * side, key);
      }
    });
    // Crossguard
    const gx = hand.x + d.x * 1.8, gy = hand.y + d.y * 1.8;
    for (let s = -2; s <= 2; s += 0.5) {
      px(ctx, ox + gx + edge.x * s, oy + gy + edge.y * s, Math.abs(s) < 0.6 ? 'I' : 'i');
    }

    // Far arm reaches the grip behind the body
    line(ctx, ox + shFar.x, oy + shFar.y, ox + hand.x, oy + hand.y, 'J', 2);

    // Body (no arms, no back sword — it's in his hands)
    drawPose(ctx, { legs, arms: null, scarf: k.smearFrom != null ? 'up' : 'hang', upperDx: k.dx }, ox, oy);

    // Near arm from shoulder to hands
    const ax = hand.x - sh.x, ay = hand.y - sh.y;
    const alen = Math.hypot(ax, ay) || 1;
    const perp = { x: -ay / alen, y: ax / alen };
    for (let t = 0; t <= 1; t += 0.5 / alen) {
      const x = sh.x + ax * t, y = sh.y + ay * t;
      px(ctx, ox + x + perp.x * 0.5, oy + y + perp.y * 0.5, 'k');
      px(ctx, ox + x - perp.x * 0.5, oy + y - perp.y * 0.5, 'l');
    }

    // Grip, hands, pommel
    for (let s = -1; s <= 1; s += 0.5) px(ctx, ox + hand.x + d.x * s, oy + hand.y + d.y * s, 'o');
    px(ctx, ox + hand.x, oy + hand.y, 's');
    px(ctx, ox + hand.x + 1, oy + hand.y, 's');
    px(ctx, ox + hand.x, oy + hand.y + 1, 'S');
    px(ctx, ox + hand.x + 1, oy + hand.y + 1, 'S');
    px(ctx, ox + hand.x - d.x * 2, oy + hand.y - d.y * 2, 'i');

    // Blade tip in body-local pixels (24x24 box, y down), used for impact effects
    const tip = { x: hand.x + d.x * (bladeStart + BLADE_LEN), y: hand.y + d.y * (bladeStart + BLADE_LEN) };
    return { canvas: c, dur: k.dur, hit: !!k.hit, swing: !!k.swing, peak: !!k.peak, tip };
  }

  const ATTACK = KEYS.map(attackFrame);

  window.BoyAnimation = {
    IDLE,
    WALK,
    JUMP_CROUCH,
    JUMP_RISE,
    JUMP_APEX,
    FALL,
    JUMP_SPIN,
    HIT_1,
    HIT_1_FLASH: flashOf(HIT_1),
    HIT_2,
    DEFEATED,
    ATTACK,
    ATTACK_SIZE: { w: W, h: H },
    ATTACK_ORIGIN: ORIGIN,
    ATTACK_DURATION: ATTACK.reduce((sum, f) => sum + f.dur, 0)
  };
})();
