# Planet Texture Options

This note records texture options for Solitude's planets, with Earth as the
first target. It is intentionally scoped to the current renderer: WebGL2 solid
meshes, engine-owned scene contracts, and server-safe solar-system content in
`@solitude/sim`.

## Current Renderer Fit

- Solar-system planets are authored in
  `packages/sim/src/plugins/solarSystem/solarSystem.ts` as scaled copies of a
  shared unit icosphere.
- Earth currently differs only by RGB color, physical/orbital data, axial tilt,
  and spin.
- `EntityRenderConfig` and `SceneObject` carry color, mesh, LOD, shading,
  scale, and optional material metadata.
- `GpuMeshRenderer` uploads position, normal, and face-anchor attributes; the
  solid-mesh shader computes lighting and multiplies by `uBaseColor`.
- The current checked-in Earth texture lives under
  `packages/display/src/assets/textures/`.

The low-friction texture path is to keep the mesh buffer unchanged and derive
spherical UVs in the shader from local sphere position/normal. That works well
for the current `unitIcosphere` LOD path and avoids expanding every vertex with
stored UV coordinates.

## Asset Sources

### NASA Blue Marble

Recommended first Earth source. For the first in-app texture, use the older
Blue Marble 2002 land/ocean/ice map because it gives Earth the familiar blue
ocean appearance without color-tuning the source. The Blue Marble Next
Generation topography/bathymetry maps are useful references, but their deep
oceans read too dark in Solitude's lighting.

- Source: https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/
- Source: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
- Also useful: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
- Smaller browsing/download endpoint: https://neo.gsfc.nasa.gov/view.php?datasetId=BlueMarbleNG
- NASA image guidance: https://gpm.nasa.gov/image-use-policy

Pros:

- Strong provenance and broadly usable NASA imagery.
- Equirectangular global maps are available in small and large sizes.
- The 2002 land/ocean/ice map has readable blue oceans without shader-specific
  ocean tinting.

Trade-offs:

- The Blue Marble 2002 land/ocean/ice map is static and cloud-free.
- Baked topography can visually conflict with physically computed lighting, but
  this is relevant only if using the Next Generation topography/bathymetry maps.
- Attribution should be included in repo docs or an in-app credits surface.

Good MVP size: the 8192x4096 land/ocean/ice source converted to JPEG for app
bundle size. Larger or lossless maps can wait until texture streaming/compression
decisions exist.

Current app asset:

- Source: NASA Blue Marble 2002 `land_ocean_ice_8192.png`.
- App file:
  `packages/display/src/assets/textures/earth-blue-marble-land-ocean-ice-8192.jpg`
- Processing: format conversion from PNG to JPEG at quality 90 only; no gamma
  or color correction.

### Solar System Scope

Convenient planet-pack option.

- Source: https://www.solarsystemscope.com/textures/

Pros:

- Cohesive set for multiple planets.
- Includes day, night, cloud, normal, and specular variants for Earth.
- Easy to use for Mars, Moon, gas giants, and ice giants.

Trade-offs:

- Attribution/license terms must be tracked.
- The aesthetic is more pre-authored than scientific-source-first.
- Some maps may need color/exposure tuning to match Solitude's lighting.

Good use: second pass if the goal becomes "texture the whole solar system"
rather than "prove Earth texture support."

### Natural Earth

Good stylized/cartographic fallback.

- Source: https://www.naturalearthdata.com/downloads/10m-raster-data/

Pros:

- Public-domain raster products.
- Useful if we want a clean map-like Earth that remains legible from far away.

Trade-offs:

- Less natural from low orbit.
- Better suited to a presentation mode than the default flight view.

## Implementation Paths

### Path A: Single Earth Day Texture

Best first slice.

1. Add a generic render material field to engine render config and scene
   objects, for example:

   ```ts
   export type RenderMaterial =
     | { kind: "solidColor" }
     | {
         kind: "sphericalTexture";
         textureId: string;
         longitudeOffsetRad?: number;
       };
   ```

2. Let solar-system content assign Earth a stable texture id such as
   `solitude.texture.earth.day`.
3. Keep `@solitude/sim` server-safe by storing only the id and mapping
   texture ids to browser asset URLs in browser/client/standalone composition.
4. Extend `GpuMeshRenderer` with a texture cache keyed by texture id/source.
5. In the shader, compute UV from local sphere coordinates and sample the day
   texture. Fall back to `uBaseColor` when no texture is bound.

This proves the full data path without adding cloud layers, night lights,
normal maps, or mesh-format churn.

### Path B: Procedural Earth-Like Shader

Useful as an asset-free experiment, not the best product direction.

Pros:

- No asset licensing or loading pipeline.
- Fast to prototype and easy to parameterize.

Trade-offs:

- Hard to make Earth recognizable.
- Procedural coastlines are poor value compared with public-domain imagery.
- Eventually replaced by real texture support anyway.

### Path C: Full Planet Material Stack

Better second phase after Path A works.

Possible material layers:

- Day albedo texture.
- Night emissive texture blended by the sun-facing dot product.
- Cloud texture on a slightly larger transparent sphere.
- Specular mask for oceans.
- Normal or bump map for terrain/cloud relief.

This should wait until the single-texture path is stable, because each layer
adds shader branches, texture bindings, asset memory, and loading states.

## Shader Mapping Notes

For current unit spheres, local `z` is the natural north/south axis. A fragment
shader can derive UVs from local normal:

```glsl
vec3 n = normalize(vLocalPosition);
float u = atan(n.y, n.x) / (2.0 * PI) + 0.5;
float v = asin(clamp(n.z, -1.0, 1.0)) / PI + 0.5;
```

Most equirectangular textures place north at the top, so the sampled `v` may
need to be flipped:

```glsl
vec2 uv = vec2(u + uLongitudeOffset, 1.0 - v);
```

Keep `longitudeOffsetRad` or equivalent in the material. The current planetary
orientation starts from identity and then spins, so a small authoring offset is
the simplest way to align Earth's prime meridian and make visual inspection
less surprising.

## Recommended First Slice

Build Path A with one NASA Blue Marble land/ocean/ice Earth texture.

Keep it narrow:

- One optional material field in engine render contracts.
- One browser-owned texture-provider or texture-manifest mapping.
- One WebGL texture cache in `GpuMeshRenderer`.
- One shader path for spherical day textures.
- Earth uses the texture; all other bodies keep solid colors.
- If loading fails, Earth renders with the current solid blue color.

Do not put image imports in `@solitude/sim`; server/headless composition uses
that package. Put actual bitmap assets and URL imports in a browser-facing
package or public asset directory.

## Later Questions

- Where should user-visible asset credits live?
- Should texture quality be tied to runtime options for low-memory devices?
- Should remote clients receive texture ids from server model snapshots, or
  should they apply a client-side visual catalog based on known entity ids?
- Should planet maps use compressed GPU texture formats later, such as KTX2,
  after the plain-image path proves useful?
