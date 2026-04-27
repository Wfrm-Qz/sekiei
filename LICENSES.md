# Third-Party Licenses

This file summarizes the third-party software and bundled font assets included in
this repository.

For this repository's own licensing terms, see:

- `LICENSE` for the MIT-licensed application source code and project
  documentation
- `docs/licensing.md` for the separate CC BY 4.0 preset data notice
- `src/data/presets/README.md` for the preset data attribution requirements

## Runtime Dependencies

### Three.js

- Package: `three`
- License: MIT
- Used for:
  - 3D preview rendering
  - `TrackballControls`
  - `STLExporter`
  - text outline loading and 2D shape triangulation
- Upstream:
  - https://threejs.org/
  - https://github.com/mrdoob/three.js

### three-bvh-csg

- Package: `three-bvh-csg`
- License: MIT
- Used for:
  - boolean union processing for crystal geometry
- Upstream:
  - https://github.com/gkjohnson/three-bvh-csg

### three-mesh-bvh

- Package: `three-mesh-bvh`
- License: MIT
- Used for:
  - dependency of `three-bvh-csg`
- Upstream:
  - https://github.com/gkjohnson/three-mesh-bvh

### OpenJSCAD Modeling

- Package: `@jscad/modeling`
- License: MIT
- Used for:
  - helper geometry generation
  - some preview and export geometry operations
- Upstream:
  - https://github.com/jscad/OpenJSCAD.org

## Development and Verification Tools

These packages are used for development, linting, testing, or build-time
verification. They are not bundled as browser runtime dependencies of the app.

### MIT-licensed tools

- `vite`
- `vitest`
- `prettier`
- `eslint`
- `stylelint`
- `html-validate`

### Apache-2.0-licensed tools

- `@playwright/test`
- `typescript`

## Bundled Fonts

The following font JSON files are bundled for face text generation.

### Helvetiker / Optimer

- Files:
  - `assets/fonts/helvetiker_regular.typeface.json`
  - `assets/fonts/optimer_regular.typeface.json`
- License family:
  - MgOpen Font License
- Included license text:
  - `assets/fonts/LICENSE-MgOpen.txt`
- Notes:
  - The same license text is also embedded in each JSON file under
    `original_font_information.license_description`
  - These files are derived from the `three/examples/fonts` distribution

### Gentilis

- File:
  - `assets/fonts/gentilis_regular.typeface.json`
- License:
  - SIL Open Font License 1.1
- Included license text:
  - `assets/fonts/LICENSE-Gentilis-OFL-1.1.txt`
- Notes:
  - The same license text is also embedded in the JSON file under
    `original_font_information.license_description`
  - This file is derived from the `three/examples/fonts` distribution

### Sora

- File:
  - `assets/fonts/Sora-wght.ttf`
- License:
  - SIL Open Font License 1.1
- Included license text:
  - `assets/fonts/LICENSE-Sora-OFL-1.1.txt`
- Notes:
  - Used for the title-card SEKIEI logo
  - The font file is sourced from the Google Fonts `ofl/sora` distribution

## Notes

- This repository does not intentionally include GPL- or LGPL-licensed runtime
  dependencies.
- This repository's own project license is MIT. See the root-level `LICENSE`
  file.
