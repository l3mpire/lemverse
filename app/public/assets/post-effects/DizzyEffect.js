const Phaser = require('phaser');

const fragShader = `
#define SHADER_NAME BEND_WAVES_FS

precision mediump float;

uniform float uTime;
uniform sampler2D uMainSampler;
varying vec2 outTexCoord;

void main( void )
{
    vec2 uv = outTexCoord;
    uv.x += cos(uv.y * 4.0 + uTime) * 0.05;
    uv.y += sin(uv.x * 4.0 + uTime) * 0.05;

    float offset = sin(uTime * 0.3) * 0.05;    
    vec4 a = texture2D(uMainSampler, uv);    
    vec4 b = texture2D(uMainSampler, uv - vec2(sin(offset), 0.0));    
    vec4 c = texture2D(uMainSampler, uv + vec2(sin(offset), 0.0));    
    vec4 d = texture2D(uMainSampler, uv - vec2(0.0, sin(offset)));    
    vec4 e = texture2D(uMainSampler, uv + vec2(0.0, sin(offset))); 

    gl_FragColor = (a+b+c+d+e) / 10.0;
}
`;

export default class PostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game) {
    super({
      game,
      renderTarget: true,
      fragShader,
      uniforms: [
        'uProjectionMatrix',
        'uMainSampler',
        'uTime',
      ],
    });
    this._time = 0;
  }

  onPreRender() {
    this._time += 0.05;
    this.set1f('uTime', this._time);
  }
}
