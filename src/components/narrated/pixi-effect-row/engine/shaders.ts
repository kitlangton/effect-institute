export const ENERGY_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`

export const ENERGY_FRAGMENT = `
in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uSize;
uniform float uSpeed;
uniform float uBandWidth;
uniform float uBandSoftness;
uniform float uBandSpacing;
uniform float uBandCount;
uniform float uIntensity;
uniform float uMix;
uniform float uInsetX;
uniform float uInsetTop;
uniform float uInsetBottom;
uniform float uPulseSpeed;
uniform float uRotation;

out vec4 finalColor;

float bandPx(float x, float center, float width, float softness)
{
    float dist = abs(x - center);
    return smoothstep(width, width - softness, dist);
}

void main(void)
{
    vec2 uv = vTextureCoord;
    vec4 color = texture(uTexture, uv);
    float alpha = color.a;
    vec3 base = color.rgb;

    float x = uv.x * uSize.x;
    float y = uv.y * uSize.y;
    float centerX = uSize.x * 0.5;
    float centerY = uSize.y * 0.5;
    float dx = x - centerX;
    float dy = y - centerY;
    float cosR = cos(uRotation);
    float sinR = sin(uRotation);
    float rx = dx * cosR + dy * sinR + centerX;
    float ry = -dx * sinR + dy * cosR + centerY;
    float travel = max(uSize.x + uBandWidth * 2.0 + uBandSpacing * (uBandCount - 1.0), 1.0);
    float start = mod(uTime * uSpeed, travel) - uBandWidth;
    float centerA = start;
    float centerB = start - uBandSpacing;
    float centerC = start - uBandSpacing * 2.0;
    float centerD = start - uBandSpacing * 3.0;

    float w1 = step(0.5, uBandCount);
    float w2 = step(1.5, uBandCount);
    float w3 = step(2.5, uBandCount);
    float w4 = step(3.5, uBandCount);

    float bandA = bandPx(rx, centerA, uBandWidth, uBandSoftness) * w1;
    float bandB = bandPx(rx, centerB, uBandWidth, uBandSoftness) * w2;
    float bandC = bandPx(rx, centerC, uBandWidth, uBandSoftness) * w3;
    float bandD = bandPx(rx, centerD, uBandWidth, uBandSoftness) * w4;
    float bands = max(bandA, max(bandB, max(bandC, bandD)));

    float insetXEnabled = step(0.5, uInsetX);
    float topEnabled = step(0.5, uInsetTop);
    float bottomEnabled = step(0.5, uInsetBottom);
    float leftMask = mix(1.0, smoothstep(uInsetX, uInsetX + 8.0, rx), insetXEnabled);
    float rightMask = mix(
        1.0,
        1.0 - smoothstep(uSize.x - uInsetX - 8.0, uSize.x - uInsetX, rx),
        insetXEnabled
    );
    float topMask = mix(1.0, smoothstep(uInsetTop, uInsetTop + 8.0, ry), topEnabled);
    float bottomMask = mix(
        1.0,
        1.0 - smoothstep(uSize.y - uInsetBottom - 8.0, uSize.y - uInsetBottom, ry),
        bottomEnabled
    );
    float center = leftMask * rightMask * topMask * bottomMask;

    float pulse = 0.85 + 0.15 * sin(uTime * uPulseSpeed);
    float intensity = bands * center * pulse * uIntensity;

    vec3 glow = vec3(0.35, 0.7, 1.0) * intensity;
    vec3 outColor = base + glow * alpha;
    outColor = mix(outColor, vec3(1.0) * alpha, intensity * uMix);

    finalColor = vec4(outColor, alpha);
}
`

export const FAILURE_PULSE_FRAGMENT = `
in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uSize;
uniform float uProgress;
uniform float uWidth;
uniform float uSoftness;
uniform float uIntensity;
uniform float uNoise;
uniform float uColorMix;
uniform float uTail;
uniform float uFadeIn;
uniform float uFadeOut;
uniform float uNoiseScale;
uniform vec3 uColor;

out vec4 finalColor;

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(void)
{
    vec2 uv = vTextureCoord;
    vec4 base = texture(uTexture, uv);
    float alpha = base.a;

    vec2 pos = uv * uSize;
    vec2 center = uSize * 0.5;
    float dist = length(pos - center);
    float maxRadius = length(uSize * 0.5);
    float progress = clamp(uProgress, 0.0, 1.0);
    float radius = maxRadius * progress;
    float width = max(uWidth, 0.001);
    float softness = max(uSoftness, 0.001);

    float innerSoft = softness * (1.0 + uTail);
    float inner = smoothstep(radius - width - innerSoft, radius - width, dist);
    float outer = 1.0 - smoothstep(radius + width, radius + width + softness, dist);
    float ring = inner * outer;

    float noise = rand(uv * uSize * uNoiseScale + uTime * 4.0);
    ring *= mix(1.0 - uNoise, 1.0 + uNoise, noise);

    float fadeIn = smoothstep(0.0, max(uFadeIn, 0.001), progress);
    float fadeOut = 1.0 - smoothstep(uFadeOut, 1.0, progress);
    float intensity = ring * uIntensity * fadeIn * fadeOut;
    vec3 ringColor = mix(uColor, vec3(1.0), uColorMix);

    finalColor = vec4(ringColor * intensity, intensity);
}
`
