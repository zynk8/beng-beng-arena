# Tactical Neon-Chrome Soldier GLB Prompt

Create a high-fidelity 3D character model of a tactical special forces soldier, optimized for browser GLTF/GLB usage.

The soldier wears sleek, dark matte carbon-fiber armor with glowing neon-magenta and cyan diegetic LED strips along the seams. The helmet has a futuristic tactical visor with a 1990s retro-tech interface overlay. Use realistic human proportions in T-pose, with modular weapon attachments. Textures should include PBR materials for metal, fabric, rubber, armor plating, and emissive LED maps.

Aesthetic: modern tactical special forces meets 1990s Hong Kong neon-noir.

## Export Specs

- Format: `.glb`
- Target filename: `neon_chrome_soldier.glb`
- Triangle budget: `10k-15k`
- Texture size: `1024x1024`
- Materials: PBR metallic/roughness with emissive maps
- Required clips: `Idle`, `Run`, `Shoot`, `Crouch_Walk`, `Impact_Death`
- Rig: humanoid skeletal rig
- Scale: 1 unit = 1 meter
- Character height: about 1.8 units

## Browser Runtime Notes

- Keep the final `.glb` in `public/assets/neon_chrome_soldier.glb`.
- Use compressed textures such as KTX2/Basis later when the art pipeline is stable.
- Runtime collider should be a Rapier kinematic capsule around the model, not the mesh triangles.
- Health feedback should shift emissive armor strips from neon-cyan to hazard-orange when damaged.
