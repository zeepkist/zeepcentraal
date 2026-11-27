---
title: Sign Text
description: Rich text tags for sign colours, letter styles, spacing and layout.
editPath: wiki/level-editor/sign-text.md
---

Rich text tags change how text looks on a sign. Type them into the sign's text field, alongside your words.

## How tags work

Most tags have an opening tag and a closing tag. The closing tag starts with `/` and ends the effect.

```text
<b>Turn left</b> at the next corner
```

Only “Turn left” is bold. You can combine tags:

```text
<color=#FF8800><b>Slow down!</b></color>
```

Some tags take a value after `=`:

```text
<size=150%>Finish</size>
```

Others, such as `<br>`, need no closing tag.

The tags below cover [Unity's rich text list](https://docs.unity3d.com/2021.3/Documentation/Manual/UIE-supported-tags.html). The built-in fonts, gradients and sprites listed here were checked in Zeepkist v18p17's game files and code. These examples have not been tested in a running game.

## Letter styles

**`<b>`** makes text bold.

```text
<b>Warning</b>
```

**`<i>`** makes text italic.

```text
<i>Mind the gap</i>
```

**`<u>`** adds an underline.

```text
<u>Start here</u>
```

**`<s>`** adds a line through text.

```text
<s>Closed</s> Open
```

**`<size>`** changes letter size. Use a percentage, pixels such as `24px`, or font units such as `1.5em`. Values such as `+4` and `-4` change the original size, not the previous tag's size.

```text
<size=150%>Finish</size>
```

**`<sub>`** puts small text below the normal line.

```text
H<sub>2</sub>O
```

**`<sup>`** puts small text above the normal line.

```text
m<sup>2</sup>
```

## Capital letters

**`<uppercase>`** shows capital letters. This displays “FINISH”.

```text
<uppercase>Finish</uppercase>
```

**`<allcaps>`** does the same as `<uppercase>`.

```text
<allcaps>Finish</allcaps>
```

**`<lowercase>`** shows lowercase letters. This displays “finish”.

```text
<lowercase>FINISH</lowercase>
```

**`<smallcaps>`** shows capital letters, with smaller letters where you typed lowercase.

```text
<smallcaps>Finish</smallcaps>
```

See [Unity's letter case guide](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/RichTextLetterCase.html) for examples of small caps.

## Colours and highlights

**`<color>`** changes text colour. Use a colour name or a hex value. The short form also works. Eight hex digits include opacity; the last example is partly transparent red.

```text
<color=red>Stop</color>
<color=#FF8800>Slow</color>
<#FF8800>Slow</color>
<color=#FF000080>Stop</color>
```

**`<alpha>`** changes opacity. `00` is invisible; `FF` is fully visible. Use another alpha tag to reset it.

```text
<alpha=#80>Faded<alpha=#FF> Normal
```

**`<mark>`** adds a coloured highlight. Keep the highlight partly transparent so the letters show through.

```text
<mark=#FFFF0080>Warning</mark>
```

**`<gradient>`** uses a named gradient preset. V18 includes four presets, listed below. See [Unity's gradient guide](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/RichTextGradient.html).

```text
<gradient="Blue to Purple - Vertical">Finish</gradient>
```

### Make gradient text

Use [Unity Gradient Maker](https://kanatimc.github.io/Unity-Gradient-Maker/) to make text that fades between colours.

1. Enter your text.
2. Choose a colour effect and colours.
3. Copy the **Unity Rich Text** output.
4. Paste it into the sign's text field.

Choose Unity Rich Text rather than HTML or BBCode. This uses colour tags, so you do not need a named gradient preset.

## Lines and alignment

**`<br>`** starts a new line.

```text
Turn left<br>Then right
```

**`<align>`** sets horizontal alignment. Values: `left`, `center`, `right`, `justified`, `flush`. Justified text spreads words across each line except the last. Flush also spreads the last line. The last alignment tag on a line wins.

```text
<align=center>Finish</align>
```

**`<line-height>`** sets the distance between lines. Use pixels, font units, or a percentage of the normal line height.

```text
<line-height=150%>Turn left<br>Then right</line-height>
```

**`<nobr>`** keeps words on the same line.

```text
<nobr>Checkpoint 1</nobr>
```

**`<width>`** sets the text area's width. It changes where text wraps, not letter width.

```text
<width=60%>Keep this message narrow</width>
```

## Spacing and position

`px` means pixels. `em` scales with the font size. Percentage values depend on the tag.

**`<cspace>`** changes gaps between letters. Positive values spread letters out. Negative values pull them together.

```text
<cspace=0.2em>Finish</cspace>
```

**`<mspace>`** gives each character the same width.

```text
<mspace=1em>01:23</mspace>
```

**`<space>`** adds a horizontal gap. Use pixels or font units. No closing tag.

```text
Left<space=2em>Right
```

**`<pos>`** sets where the next text starts across the current line. Use pixels, font units, or percentages. No closing tag.

```text
Time<pos=60%>01:23
```

**`<indent>`** moves text in from the left, including wrapped lines.

```text
<indent=10%>Keep left on the next corner</indent>
```

**`<line-indent>`** moves only the first line after each manual line break. Wrapped lines keep their normal position.

```text
<line-indent=10%>First<br>Second</line-indent>
```

**`<margin>`** adds space on both sides. Use pixels, font units, or percentages. Negative margins have no effect.

```text
<margin=1em>Keep clear</margin>
```

**`<margin-left>`** sets only the left margin. No closing tag. Set it to `0` to remove the margin.

```text
<margin-left=1em>Keep clear
```

**`<margin-right>`** sets only the right margin. No closing tag. Set it to `0` to remove the margin.

```text
<margin-right=1em>Keep clear
```

**`<voffset>`** moves text above or below its normal line. Negative values move text down. Use pixels or font units.

```text
Jump <voffset=0.5em>up</voffset>
```

**`<rotate>`** turns each letter around its centre. Positive degrees turn anticlockwise; negative degrees turn clockwise. Add character spacing if letters overlap.

```text
<rotate=15>Finish</rotate>
```

See [Unity's indentation guide](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/RichTextIndentation.html) for the difference between indents and line indents.

## Fonts, sprites, and styles

These tags use assets included in the game. Keep the asset names as shown.

**`<font>`** selects a font. Use one of the six rich text fonts listed below.

```text
<font="Anton SDF">Finish</font>
```

**`<sprite>`** inserts an image from a sprite sheet. No closing tag. All visible built-in sprites are listed below.

```text
<sprite="zeepkist" name="Heart">
```

**`<style>`** applies a named style. V18 includes the styles listed below.

```text
<style="Title">Finish</style>
```

## Show tags as text

**`<noparse>`** shows tags without applying them:

```text
<noparse><b>Finish</b></noparse>
```

The sign shows the tags as text:

```text
<b>Finish</b>
```

## Built-in V18 fonts

These six fonts work with `<font>` tags. Each line uses the exact asset name.

```text
<font="Anton SDF">Anton</font>
<font="Bangers SDF">Bangers</font>
<font="Electronic Highway Sign SDF">Electronic Highway Sign</font>
<font="LiberationSans SDF">Liberation Sans</font>
<font="Oswald Bold SDF">Oswald</font>
<font="Roboto-Bold SDF">Roboto</font>
```

Use the `default` value to return to the font chosen in the sign editor:

```text
<font="Anton SDF">Heading</font>
<font="default">Sign font</font>
```

### Fonts in the sign selector

The sign editor also has these 24 font families. Choose them in the font selector. These menu names are not values for `<font>` tags.

```text
Anja Eliane
Attack Graffiti
Batuphat Script
Buba Outline
Buba Stripes
Classica
Code New Roman
Comic Helvetic
Computerist
Coolvetica
Diskopia
Grandstander
Hybrid
Hybrid Outline
LCD
LT Saeada
Monoround
Moshin
Nulshock
Quicksilver
RNS Baruta
Speculum
Subway Black
Subway Shadow
```

## Built-in V18 gradients

These four presets fade vertically. Use white text for the preset's original colours. A text colour tints the gradient.

```text
<gradient="Blue to Purple - Vertical">Finish</gradient>
<gradient="Dark to Light Green - Vertical">Finish</gradient>
<gradient="Light to Dark Green - Vertical">Finish</gradient>
<gradient="Yellow to Orange - Vertical">Finish</gradient>
```

## Supported Unicode symbols

Copy these characters into sign text. They display in-game without sprite tags.

```text
✀ ✁ ✂ ✃ ✄ ✅ ✆ ✇ ✈ ✉ ✊ ✋ ✌ ✍ ✎ ✏ ✐ ✑ ✒ ✓ ✔ ✕ ✖ ✗ ✘ ✙ ✚ ✛ ✜ ✝ ✞ ✟
✠ ✡ ✢ ✣ ✤ ✥ ✦ ✧ ✨ ✩ ✪ ✫ ✬ ✭ ✮ ✯ ✰ ✱ ✲ ✳ ✴ ✵ ✶ ✷ ✸ ✹ ✺ ✻ ✼ ✽ ✾ ✿
❀ ❁ ❂ ❃ ❄ ❅ ❆ ❇ ❈ ❉ ❊ ❋ ❌ ❍ ❎ ❏ ❐ ❑ ❒ ❓ ❔ ❕ ❖ ❗ ❘ ❙ ❚ ❛ ❜ ❝ ❞ ❟
❠ ❡ ❢ ❣ ❤ ❥ ❦ ❧ ❨ ❩ ❪ ❫ ❬ ❭ ❮ ❯ ❰ ❱ ❲ ❳ ❴ ❵ ❶ ❷ ❸ ❹ ❺ ❻ ❼ ❽ ❾ ❿
➀ ➁ ➂ ➃ ➄ ➅ ➆ ➇ ➈ ➉ ➊ ➋ ➌ ➍ ➎ ➏ ➐ ➑ ➒ ➓ ➔ ➕ ➖ ➗ ➘ ➙ ➚ ➛ ➜ ➝ ➞ ➟
➠ ➡ ➢ ➣ ➤ ➥ ➦ ➧ ➨ ➩ ➪ ➫ ➬ ➭ ➮ ➯ ➰ ➱ ➲ ➳ ➴ ➵ ➶ ➷ ➸ ➹ ➺ ➻ ➼ ➽ ➾ ➿
```

## Built-in V18 sprites

Copy a line to use one sprite. Use **Copy grid for game** to copy a whole sheet as a grid with up to four columns and double line spacing. Paste the grid into a sign to preview the sprites in-game. Reduce the sign's text size if the grid does not fit.

There are 86 visible sprites across eight sheets. The extra unnamed slots in `zeepkist2` are transparent, so they are not listed. Some names look unusual. Keep their spelling.

### achievement 2

::content-sprite-list{sheet="achievement 2"}
```text
<sprite="achievement 2" name="host_client">
```
::

### Default Sprite Asset

::content-sprite-list{sheet="Default Sprite Asset"}
```text
<sprite="Default Sprite Asset" name="Smiley">
<sprite="Default Sprite Asset" name="Default Sprite Asset_1">
<sprite="Default Sprite Asset" name="Wink">
<sprite="Default Sprite Asset" name="Default Sprite Asset_3">
<sprite="Default Sprite Asset" name="Whaaat!">
<sprite="Default Sprite Asset" name="Default Sprite Asset_5">
<sprite="Default Sprite Asset" name="Default Sprite Asset_6">
<sprite="Default Sprite Asset" name="Default Sprite Asset_7">
<sprite="Default Sprite Asset" name="Default Sprite Asset_8">
<sprite="Default Sprite Asset" name="Unity Logo">
<sprite="Default Sprite Asset" name="Default Sprite Asset_12">
<sprite="Default Sprite Asset" name="Default Sprite Asset_13">
<sprite="Default Sprite Asset" name="Default Sprite Asset_14">
<sprite="Default Sprite Asset" name="Default Sprite Asset_15">
```
::

### DropCap Numbers

::content-sprite-list{sheet="DropCap Numbers"}
```text
<sprite="DropCap Numbers" name="03A5">
<sprite="DropCap Numbers" name="1">
<sprite="DropCap Numbers" name="2">
<sprite="DropCap Numbers" name="3">
<sprite="DropCap Numbers" name="4">
<sprite="DropCap Numbers" name="5">
<sprite="DropCap Numbers" name="6">
<sprite="DropCap Numbers" name="7">
<sprite="DropCap Numbers" name="8">
<sprite="DropCap Numbers" name="9">
<sprite="DropCap Numbers" name="0-Large">
<sprite="DropCap Numbers" name="1-Large">
<sprite="DropCap Numbers" name="2-Large">
<sprite="DropCap Numbers" name="3-Large">
```
::

### EmojiOne

::content-sprite-list{sheet="EmojiOne"}
```text
<sprite="EmojiOne" name="Smiling face with smiling eyes">
<sprite="EmojiOne" name="1f60b">
<sprite="EmojiOne" name="1f60d">
<sprite="EmojiOne" name="1f60e">
<sprite="EmojiOne" name="Grinning face">
<sprite="EmojiOne" name="1f601">
<sprite="EmojiOne" name="Face with tears of joy">
<sprite="EmojiOne" name="1f603">
<sprite="EmojiOne" name="1f604">
<sprite="EmojiOne" name="1f605">
<sprite="EmojiOne" name="1f606">
<sprite="EmojiOne" name="1f609">
<sprite="EmojiOne" name="1f618">
<sprite="EmojiOne" name="1f923">
<sprite="EmojiOne" name="263a">
<sprite="EmojiOne" name="2639">
```
::

### moremojis

::content-sprite-list{sheet="moremojis"}
```text
<sprite="moremojis" name="CoolOrange">
<sprite="moremojis" name="WhereMoney">
<sprite="moremojis" name="RainbowMoney">
<sprite="moremojis" name="Money">
<sprite="moremojis" name="ZaagBladPadRood2">
<sprite="moremojis" name="ZaagBladPadRood">
<sprite="moremojis" name="ZaagBladPad2">
<sprite="moremojis" name="ZaagBladPad">
<sprite="moremojis" name="Work">
<sprite="moremojis" name="Euro">
<sprite="moremojis" name="Exclemation">
<sprite="moremojis" name="Love">
<sprite="moremojis" name="Z">
<sprite="moremojis" name="E2">
<sprite="moremojis" name="E">
<sprite="moremojis" name="P">
<sprite="moremojis" name="K">
<sprite="moremojis" name="I">
<sprite="moremojis" name="S">
<sprite="moremojis" name="T">
```
::

### zeepkist

::content-sprite-list{sheet="zeepkist"}
```text
<sprite="zeepkist" name="YannicScared">
<sprite="zeepkist" name="YannicSmile">
<sprite="zeepkist" name="YannicEyes">
<sprite="zeepkist" name="Eyes">
<sprite="zeepkist" name="Host">
<sprite="zeepkist" name="Question">
<sprite="zeepkist" name="Smile">
<sprite="zeepkist" name="Skull">
<sprite="zeepkist" name="Amaze">
<sprite="zeepkist" name="Good">
<sprite="zeepkist" name="Sparkle">
<sprite="zeepkist" name="Heart">
<sprite="zeepkist" name="Love">
<sprite="zeepkist" name="Cry">
<sprite="zeepkist" name="Party">
```
::

### zeepkist2

::content-sprite-list{sheet="zeepkist2"}
```text
<sprite="zeepkist2" name="Wisdom">
<sprite="zeepkist2" name="OhNo">
<sprite="zeepkist2" name="Anchor">
```
::

### zeepui

::content-sprite-list{sheet="zeepui"}
```text
<sprite="zeepui" name="axis">
<sprite="zeepui" name="button">
<sprite="zeepui" name="axisbutton">
```
::

## Built-in V18 styles

These styles combine size, colour or letter styles. `Link` changes the look of text; it does not make a sign open a web page. `Normal` adds no formatting.

```text
<style="H1">Finish</style>
<style="Quote">Finish</style>
<style="Link">Finish</style>
<style="Title">Finish</style>
<style="H2">Finish</style>
<style="H3">Finish</style>
<style="C1">Finish</style>
<style="C2">Finish</style>
<style="C3">Finish</style>
<style="Normal">Finish</style>
```

For more syntax examples, see [Unity's rich text guide](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/RichText.html) and [tag reference](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/RichTextSupportedTags.html).
