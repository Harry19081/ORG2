# CodeMirror diff presentation

Unified, split and regular editors use far-left change rails and continuous gutter fills. Changed numbers and code rows use existing diff color tokens. Regular-editor deletion anchors do not paint surviving code as deleted. Collapsed unchanged regions use rounded ends, 8px side insets and identically inset gutter/content backgrounds. Stacked arrows have a 2px gap and independent hover fills; label hover fills both halves. Native expand-all and split synchronization are preserved.

| Area               | Verdict | Evidence                                                              | Change or reason kept                                                               | Verification                                       |
| ------------------ | ------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| Background work    | keep    | Four delegated mouse/focus listeners per editor, no new timer         | Plugin removes listeners on destruction                                             | Post-destroy event test                            |
| Memory             | keep    | No global cache or retained DOM-node collection                       | Number markers render on demand; row decorations derive from existing dirty markers | 10,000-line fixture formats fewer than 200 numbers |
| Scope/isolation    | keep    | Collapse positions and merge side come from each editor               | Events outside the editor clear hover; native expansion owns split coordination     | Split and matching-row tests                       |
| Rendering/hot path | keep    | Binary search per visible diff number; no geometry reads during hover | Native widget lifecycle owns gutter elements                                        | Gutter/row DOM assertions                          |

An isolated headless Chromium fixture bundled the actual shared theme, collapse theme, gutter/number extensions and compiled diff stylesheet. Leading and trailing pills measured 26px on both sides; the middle stacked pill measured 40px on both sides. Their vertical origins matched exactly. The browser also verified a 2px control gap, one-half hover and label-hover behavior. The resulting screenshot was visually inspected: [browser fixture](DiffRows.png).

This evidence covers the isolated light-theme browser fixture, not the live Tauri app, dark theme or narrow viewport. No runtime speed improvement is claimed. Performance verdict: blocked for desktop CPU/RSS and hidden/idle lifecycle measurements; source ownership and targeted lifecycle assertions pass.
