# Lobby host

## Unity rich text

Import helpers directly from `src/chat/richText.ts`. These pure string builders cover the [Unity 2021.3 supported-tag list](https://docs.unity3d.com/2021.3/Documentation/Manual/UIE-supported-tags.html). They do not send packets or change message scheduling.

```ts
import { bold, color, escapeText, size } from './chat/richText'

bold('Heading')
size(65, 'Smaller text') // <size=65%>Smaller text</size>
size('18px', bold('Heading'))
color('#FFD700', escapeText(playerName))
```

Text-only wrappers accept `text: string`: `bold`, `italic`, `underline`, `strikethrough`, `allcaps`, `uppercase`, `lowercase`, `smallcaps`, `subscript`, `superscript`, `noBreak`, `noParse`.

Value-first wrappers accept `(value, text)`: `align`, `color`, `characterSpacing`, `font`, `fontWeight`, `gradient`, `indent`, `lineHeight`, `lineIndent`, `margin`, `mark`, `monospace`, `rotate`, `size`, `style`, `verticalOffset`, `width`.

- Alignment: left, center, right, justified, flush.
- Dimensions: numeric or numeric strings, optionally suffixed with px, em, or %. Numeric `size` means percent; other numeric dimensions emit unitless values. Explicit size strings support relative +1/-1 values. Character spacing, monospace, vertical offset, and space reject percentages. Signed dimensions remain intact; Unity ignores negative margins.
- Rotation: finite degrees. Font weights: 100–900 in steps of 100.
- Colors: six/eight-digit hex or black, blue, green, orange, purple, red, white, yellow. Use translucent eight-digit hex for highlights; opaque marks can obscure text.
- Font, gradient, and style names are quoted and reject markup delimiters/control characters.

Standalone helpers return only an opening command: `lineBreak()`, `alpha('#CC')`, `position(value)`, `space(value)`, `sprite(name)`, `marginLeft(value)`, `marginRight(value)`. Opacity requires two hex digits. Sprite uses a quoted name. Stateful settings affect subsequent text until changed/reset by the renderer; helpers do not restore prior state or invent closing tags.

Wrappers preserve nested markup and do **not** escapeText text. Call `escapeText` explicitly for player-controlled text before wrapping. It retains existing ampersand/angle-bracket escaping. `noParse` is not a sanitizer: embedded closing tags can terminate it.

Markup support does not guarantee game rendering. Fonts, gradients, styles, sprites, and glyphs must exist in the Zeepkist client. These helpers do not install assets or add missing font glyphs.
