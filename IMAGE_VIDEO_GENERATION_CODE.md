# Image & Video Generation Code Transfer Guide

## How to Use This Document

Copy each section below and paste it into your other Emergent app's chat with the instruction provided. The AI agent will apply the changes.

---

## PART 1: Backend - Core Image Edit Function

**Paste this instruction into your other Emergent app:**

```
Please update the `handleImageEditInternal` function in `/app/app/api/[[...path]]/route.js`. This function handles image editing with GPT-image-1, SeeDream v4, and Flux Kontext. Replace the existing function (or add it if it doesn't exist) with this complete implementation:
```

Then paste the code block that follows.

---

## PART 2: Backend - Intent Detection

**Paste this instruction:**

```
Please update the `quickMediaIntentCheck` function in `/app/app/api/[[...path]]/route.js`. This function detects whether user input is requesting image generation, video generation, image editing, mockups, or composite edits.
```

---

## PART 3: Frontend Desktop - Stream Handlers

**Paste this instruction:**

```
In `/app/app/chat/page.js`, please update the streaming message handler to properly handle image and video generation events. Add these state variables and update the stream processing logic.
```

---

## PART 4: Frontend Desktop - Visual Generation Indicator

**Paste this instruction:**

```
In `/app/app/chat/page.js`, add/update the visual generation indicator that shows an animated loading state when images or videos are being generated.
```

---

## PART 5: Frontend Mobile - Stream Handlers

**Paste this instruction:**

```
In `/app/components/mobile/MobileChat.js`, update the streaming handler to handle image and video events, matching the desktop functionality.
```

---

## PART 6: Frontend Mobile - Visual Generation Indicator

**Paste this instruction:**

```
In `/app/components/mobile/MobileChat.js`, add the visual generation indicator for mobile.
```

---

# DETAILED CODE BLOCKS

See the extracted code in the files below. I'll create separate files for each section.

