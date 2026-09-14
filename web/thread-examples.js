/* Prepared content for reviewing the thread experience. No model calls. */
window.LearningThreadExamples = (() => {
  const source = {
    joints: 'https://modernrobotics.northwestern.edu/nu-gm-book-resource/2-2-degrees-of-freedom-of-a-robot/',
    actuation: 'https://modernrobotics.northwestern.edu/nu-gm-book-resource/8-9-actuation-gearing-and-friction/',
    wrist: 'https://sir.upc.edu/projects/kinematics_dynamics_control_practicals/kinematics/index.html#spherical-wrist',
    motors: 'https://aimrl.gatech.edu/publication/journal/2004_IFAC%20J.of%20Control%20Engineering%20Practice.vol.12%20issue%2011%20pp.1437-1449..pdf'
  };
  const concept = (key, label) => `<button type="button" class="lt-concept" data-concept="${key}" aria-label="Explore ${label} in a separate thread">${label}</button>`;
  const cite = (url, label) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
  const examples = {
    wrist: {
      title: 'Why three wrist joints?',
      question: 'Why don’t we see spherical joints in manipulator arms? For example, why is the wrist made of three joints in many commercial arms?',
      quote: 'The spherical joint (S), also called a ball-and-socket joint, has three degrees of freedom and functions much like our shoulder joint.',
      concept: 'Actuation', next: 'actuation', visual: 'wrist', kind: 'conversation',
      text: 'A spherical joint allows three rotational motions. The engineering challenge is driving and controlling those motions. The passage describes what movement a joint permits, without specifying how it is powered.\n\nImagine a camera on a tripod ball head. Loosen it and you can tilt and twist the camera easily. Making it turn to an exact orientation—and hold that orientation against a load—requires additional machinery. That is the problem of actuation.\n\nThree revolute joints give the robot one measurable angle and one axis about which to apply torque at each joint. Conventional rotary motors, gearboxes, bearings, and encoders fit this arrangement well.\n\nWhen the three rotation axes intersect at one point, the assembly is called a spherical wrist. It rotates the tool about that shared centre, within its joint limits and away from singular postures.\n\nA powered ball-and-socket is possible. Spherical motors can generate torque in three dimensions, but require specialised drive, sensing, and control systems. Spherical joints also appear as passive connections in robots such as Stewart platforms.',
      html: () => `<p><strong>A spherical joint allows three rotational motions. The challenge is driving and controlling them.</strong> The passage describes what movement a joint permits, without specifying how it is powered.</p>
        <p>Imagine a camera on a tripod ball head. Loosen it and you can tilt and twist the camera easily. Making it turn to an exact orientation—and hold that orientation against a load—requires additional machinery. That is the problem of ${concept('actuation', 'actuation')}.</p>
        <p>Three revolute joints give the robot one measurable angle and one axis about which to apply torque at each joint. Conventional rotary motors, gearboxes, bearings, and encoders fit this arrangement well. <span class="lt-inline-source">${cite(source.actuation, 'Book §8.9')}</span></p>
        <p>When those three rotation axes intersect at one point, the assembly is called a <strong>spherical wrist</strong>. It rotates the tool about that shared centre, within its joint limits and away from singular postures. “Spherical” describes the resulting motion. ${cite(source.wrist, 'Wrist geometry')}</p>
        <p>A powered ball-and-socket is possible. Spherical motors generate torque in three dimensions, but require specialised drive, sensing, and control systems. ${cite(source.motors, 'Research example')}</p>
        <p>Spherical joints also appear as <strong>passive connections</strong> in robots such as Stewart platforms. The motors do their work elsewhere. ${cite(source.joints, 'Book §2.2')}</p>`
    },
    actuation: {
      title: 'Actuation', question: 'What does actuation mean here?',
      quote: 'Making it turn to an exact orientation—and hold that orientation against a load—requires additional machinery.',
      concept: 'Torque', next: 'torque', visual: 'actuation', kind: 'sample',
      text: 'Actuation is how a robot supplies force or torque to produce motion. A joint tells us which motion is allowed. An actuator supplies the effort to make that motion happen.\n\nFor a powered hinge, the motor supplies torque, the transmission carries that torque to the joint, and an encoder measures the angle. A controller compares the measured angle with the desired angle and adjusts the motor.\n\nThe sensor measures; it does not supply the motion. A freely moving ball-and-socket provides three rotational freedoms but needs an actuation system to control its orientation.\n\nBack at the wrist question, three revolute joints make it convenient to drive and measure one angle at a time.',
      html: () => `<p><strong>Actuation is how a robot supplies force or ${concept('torque', 'torque')} to produce motion.</strong> A joint tells us which motion is allowed. An actuator supplies the effort to make that motion happen.</p>
        <p>For a powered hinge, the motor supplies torque, the transmission carries it to the joint, and an encoder measures the angle. A controller compares the measured angle with the desired angle and adjusts the motor.</p>
        <p>The sensor measures; it does not supply the motion. A freely moving ball-and-socket provides three rotational freedoms but needs an actuation system to control its orientation.</p>
        <p>Back at your wrist question, three revolute joints make it convenient to drive and measure one angle at a time. ${cite(source.actuation, 'Book §8.9')}</p>`
    },
    torque: {
      title: 'Torque', question: 'What is torque?',
      quote: 'Actuation is how a robot supplies force or torque to produce motion.',
      concept: 'Torque', next: null, visual: 'torque', kind: 'sample',
      text: 'Torque describes a force’s turning effect about an axis. Push a door near its hinge, then push with the same force near its handle. At the handle, the larger perpendicular distance gives you more torque.\n\nFor a perpendicular force, torque = force × distance from the axis. A 10 N force at 0.1 m gives 1 N·m; the same force at 0.3 m gives 3 N·m.\n\nA robot wrist needs enough torque to move its tool and resist loads that try to turn it. This is why the ability to rotate freely is only part of the design.',
      html: () => `<p><strong>Torque describes a force’s turning effect about an axis.</strong> Push a door near its hinge, then push with the same force near its handle. At the handle, the larger perpendicular distance gives you more torque.</p>
        <p>For a perpendicular force, <strong>torque = force × distance from the axis</strong>. A 10 N force at 0.1 m gives 1 N·m; the same force at 0.3 m gives 3 N·m.</p>
        <p>A robot wrist needs enough torque to move its tool and resist loads that try to turn it. This is why the ability to rotate freely is only part of the design.</p>`
    }
  };

  function visualHtml(message) {
    const v = message.visualization;
    if (v.type === 'actuation') return `<div class="lt-answer-visual"><div class="lt-visual-title">From a target angle to motion</div>
      <ol class="lt-drive-chain" aria-label="Actuation and feedback loop"><li>Target angle</li><li>Controller</li><li>Motor + transmission</li><li>Joint motion</li></ol>
      <div class="lt-feedback-loop">Encoder measures the angle → feeds it back to the controller</div>
      <p class="lt-visual-note">The motor supplies torque. The encoder measures motion.</p></div>`;
    if (v.type === 'torque') return `<div class="lt-answer-visual"><div class="lt-visual-title">Same push, different turning effect</div>
      <svg class="lt-torque-svg" role="img" aria-label="A ten newton perpendicular force at distances of 0.1 and 0.3 metres produces one and three newton metres of torque respectively."></svg>
      <p class="lt-visual-note">The force is perpendicular to the lever in both examples.</p></div>`;
    const values = v.values;
    return `<div class="lt-answer-visual" data-wrist-visual="${message.id}">
      <div class="lt-visual-title">Same tool orientation, different mechanisms</div>
      <div class="lt-wrist-pair"><figure><figcaption>Ball-and-socket <small>Motion only · no drive shown</small></figcaption><svg data-wrist-kind="ball" role="img" aria-label="A ball-and-socket at the same orientation as the three-joint wrist."></svg></figure><figure><figcaption>Three revolute joints <small>Ideal spherical wrist · motors omitted</small></figcaption><svg data-wrist-kind="wrist" role="img" aria-label="Three nested hinge axes intersecting at one point."></svg></figure></div>
      <div class="lt-wrist-controls">${['Joint 4 · turn','Joint 5 · bend','Joint 6 · tool spin'].map((label,i)=>`<label>${label}<output>${values[i]}°</output><input type="range" aria-label="${label}" min="${i===1?10:-160}" max="${i===1?150:160}" value="${values[i]}" data-wrist-control="${i}" data-visual-message="${message.id}"></label>`).join('')}</div>
      <p class="lt-visual-note">All three hinge axes meet at the marked centre. The drawings show geometry, not motor construction.</p>
    </div>`;
  }

  function drawWrist(svg, values) {
    const width = svg.clientWidth || 280, height = 245;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.replaceChildren();
    const ns='http://www.w3.org/2000/svg', scale=Math.min(width / 4.3, 63), cx=width/2, cy=height*.63;
    const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n);return n};
    const project=([x,y,z])=>[cx+scale*(.84*x-.57*y),cy+scale*(.3*x+.42*y-z)];
    const line=(points,color,stroke=2,dash)=>add('path',{d:points.map((p,i)=>(i?'L':'M')+project(p).join(',')).join(' '),fill:'none',stroke:color,'stroke-width':stroke,'stroke-linecap':'round',...(dash?{'stroke-dasharray':dash}:{})});
    const ring=(fn,r,color,stroke=3)=>line(Array.from({length:73},(_,i)=>fn([r*Math.cos(i*Math.PI/36),r*Math.sin(i*Math.PI/36),0])),color,stroke);
    const dot=(p,r,color)=>{const [x,y]=project(p);add('circle',{cx:x,cy:y,r,fill:color})};
    const a=values[0]*Math.PI/180,b=values[1]*Math.PI/180,c=values[2]*Math.PI/180;
    const rz=(p,t)=>[p[0]*Math.cos(t)-p[1]*Math.sin(t),p[0]*Math.sin(t)+p[1]*Math.cos(t),p[2]];
    const ry=(p,t)=>[p[0]*Math.cos(t)+p[2]*Math.sin(t),p[1],-p[0]*Math.sin(t)+p[2]*Math.cos(t)];
    const rotate=p=>rz(ry(rz(p,c),b),a);
    const fixed='var(--lt-fixed)',ink='var(--lt-ink)',tool='var(--lt-teal)';
    const colors=['var(--lt-axis-a)','var(--lt-axis-b)','var(--lt-axis-c)'];
    line([[0,0,-1],[0,0,0]],fixed,13);
    if(svg.dataset.wristKind==='ball'){
      dot([0,0,0],30,fixed);dot([-.06,-.06,.06],23,tool);
      ring(p=>p,.59,'var(--lt-line)',3);
    }else{
      ring(p=>rz(p,a),.97,colors[0]);
      ring(p=>rz([p[0],0,p[1]],a),.78,colors[1]);
      ring(p=>rotate(p),.59,colors[2]);
      const axes=[[0,0,1.5],rz([0,1.35,0],a),rotate([0,0,1.4])];
      axes.forEach((axis,i)=>{line([axis.map(v=>-v*.68),axis],colors[i],1.5,'4 4');const [x,y]=project(axis);add('text',{x:x+5,y:y-6,fill:colors[i]},String(i+4))});
    }
    const end=rotate([0,0,1.37]);
    line([[0,0,0],end],tool,10);
    const cross=[[-.28,0,1.37],[.28,0,1.37]];
    line(cross.map(rotate),ink,4);
    line([[-.28,0,1.37],[-.28,0,1.62]].map(rotate),ink,4);
    line([[.28,0,1.37],[.28,0,1.62]].map(rotate),ink,4);
    dot([0,0,0],4,ink);
    add('text',{x:cx,y:height-12,'text-anchor':'middle',fill:'var(--lt-muted)'},'Fixed centre');
  }

  function drawTorque(svg){
    const width=svg.clientWidth||500,height=245;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();
    const add=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;svg.append(n)};
    const x0=26,end=width-38;
    [1,3].forEach((n,i)=>{const y=77+i*115,x=x0+(end-x0)*n/3;
      add('line',{x1:x0,y1:y,x2:end,y2:y,stroke:'var(--lt-fixed)','stroke-width':9,'stroke-linecap':'round'});
      add('circle',{cx:x0,cy:y,r:8,fill:'var(--lt-ink)'});
      add('line',{x1:x,y1:y-42,x2:x,y2:y-5,stroke:'var(--lt-teal)','stroke-width':3});
      add('path',{d:`M${x-5} ${y-13}L${x} ${y-5}L${x+5} ${y-13}`,fill:'none',stroke:'var(--lt-teal)','stroke-width':3});
      add('text',{x,y:y-50,'text-anchor':'middle'},'10 N');
      add('text',{x:x0,y:y+30},`${n/10} m from hinge → ${n} N·m`);
    });
  }

  function drawVisuals(root,messages){
    root.querySelectorAll('[data-wrist-visual]').forEach(box=>{const message=messages.find(m=>m.id===box.dataset.wristVisual);if(message)box.querySelectorAll('svg').forEach(svg=>drawWrist(svg,message.visualization.values))});
    root.querySelectorAll('.lt-torque-svg').forEach(drawTorque);
  }
  return {examples,visualHtml,drawVisuals};
})();
