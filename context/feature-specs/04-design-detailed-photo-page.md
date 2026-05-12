# Fotocorp Photo Detail Page UX Breakdown

**Reference:** Getty Images photo detail page screenshot provided in chat. 
**Goal:** Replicate the successful information architecture and buying/discovery flow, but adapt it to Fotocorp’s own stock-photo product, metadata depth, brand system, subscription model, watermarking, and current database reality.

---

## 1. What the Getty Detail Page Is Actually Doing

Getty’s page is not just an image detail page. It is a **conversion page with a media viewer attached**.

The page has four jobs:

1. **Show the selected image clearly.**
2. **Prove the image is legitimate, licensed, and traceable.**
3. **Push the user toward purchase/license action.**
4. **Keep the user browsing related event assets if they are not ready to buy.**

For Fotocorp, the same logic should become:

1. **Show the selected photo beautifully with copyright-safe watermarking.**
2. **Expose enough metadata to make the asset searchable and trustworthy.**
3. **Push subscribed users toward clean download, and non-subscribed users toward signup/subscription.**
4. **Use event/category/keyword relationships to keep users exploring.**

Getty sells image-by-image licensing. Fotocorp is more subscription-led, so the right-side purchase panel should become an **access and entitlement panel**, not a Getty-style price calculator.

---

## 2. Full Getty Page Anatomy, Top to Bottom

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│                                  LOGO                                      │
├────────────────────────────────────────────────────────────────────────────┤
│  Search input: "Search the world's best editorial photos"                 │
│                                      │ Category dropdown │ Cart/Basket      │
├─────────────────────────────────────────────────────┬──────────────────────┤
│ Title + caption strip                               │ Purchase/license rail│
│ Event name                                          │                      │
│ Location + description + credit                     │                      │
├─────────────────────────────────────────────────────┤                      │
│                                                     │  Purchase a licence  │
│                MAIN IMAGE VIEWER                   │  Rights tabs         │
│                                                     │  Size radio options  │
│   left arrow                           right arrow  │  Price               │
│                                                     │  Add to basket       │
│                 watermark/credit overlay            │  Get this image CTA  │
│                                                     │                      │
├─────────────────────────────────────────────────────┤                      │
│ Save / Comp / Embed buttons                         │ Details panel        │
│                                                     │                      │
├─────────────────────────────────────────────────────┴──────────────────────┤
│ More images from this event                                                │
│ Masonry/grid of related editorial images                                   │
├────────────────────────────────────────────────────────────────────────────┤
│ Video from this event                                                      │
│ Single related video thumbnail                                             │
├────────────────────────────────────────────────────────────────────────────┤
│ Keyword chips / taxonomy tags                                              │
├────────────────────────────────────────────────────────────────────────────┤
│ Footer                                                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Section-by-Section Breakdown

### 3.1 Header Logo

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│                                  gettyimages                               │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Getty behavior

- Minimal centered logo.
- The header does not compete with the image.
- Brand presence is clear but visually quiet.

#### Fotocorp adaptation

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│                                FOTOCORP                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

Use the Fotocorp logo or clean wordmark. Keep this header calm. No over-designed navigation circus. This is a detail page, not a homepage hero.

#### Suggested improvement

Make the header sticky only if it stays compact. On scroll, it can collapse into:

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ FOTOCORP │ Search editorial photos...                         │ Account    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Search Bar Row

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search the world's best editorial photos       │ Editorial Images ▾ │ 🛒 │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Getty behavior

- Full-width search dominates the top utility area.
- Category dropdown sits inside the same row.
- Basket is visible because Getty’s core action is purchasing/licensing.

#### Fotocorp adaptation

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search Fotocorp photos, events, people, places...  │ Images ▾ │ Account │
└────────────────────────────────────────────────────────────────────────────┘
```

Recommended controls:

- Search input.
- Category/type dropdown if useful.
- Account/downloads/fotobox entry.
- Avoid showing a shopping basket unless Fotocorp truly supports cart-based checkout.

#### Suggested improvement

Getty’s search row feels utilitarian. Fotocorp can make this more premium:

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│  Search                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  🔍  Search by event, keyword, location, photographer, Fotokey...     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

On the image detail page, search should be available but not visually louder than the selected photo.

---

### 3.3 Title and Caption Strip

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ The King's Garden Party At Buckingham Palace - May 6                       │
│ LONDON, ENGLAND - MAY 6: King Charles III, Princess Anne...                │
│ Credit: WPA Pool / Getty Images                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Getty behavior

- Title is placed above the image.
- Caption is small, dense, and metadata-heavy.
- The image has enough context before the user even scrolls.

#### Fotocorp adaptation

Use only the fields Fotocorp can reliably support:

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ [Headline / Title]                                                         │
│ [Event or Category] • [Location if available] • [Date if available]        │
│ Fotokey: [legacy image code] • Photographer: [name if available]           │
└────────────────────────────────────────────────────────────────────────────┘
```

Minimum recommended fields:


| Priority | Field              | Why it matters                     |
| -------- | ------------------ | ---------------------------------- |
| 1        | Headline/title     | Primary identification             |
| 2        | Fotokey / asset ID | Business-critical legacy reference |
| 3        | Event/category     | Helps related browsing             |
| 4        | Caption            | Adds editorial context             |
| 5        | Date               | Important for editorial photos     |
| 6        | Location           | Useful for search and trust        |
| 7        | Photographer       | Attribution and credibility        |
| 8        | Copyright          | Licensing and legal clarity        |
| 9        | Keywords           | Discovery and search expansion     |


#### Suggested improvement

Do not cram every metadata field above the image. Above the image should answer:

```txt
What is this image?
Where/when is it from?
What is its Fotocorp identifier?
```

Everything else belongs in the details panel below or beside the image.

---

### 3.4 Main Image Viewer

```txt
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
│                 SELECTED IMAGE                      │
│                                                     │
│  ‹                                           ›       │
│                                                     │
│                    watermark                         │
│               Credit: WPA Pool                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Getty behavior

- Large image stage.
- Previous/next arrows allow browsing within the event/collection.
- Watermark appears over the image.
- Credit overlay appears near bottom/right.
- The displayed image is protected but still usable for evaluation.

#### Fotocorp adaptation

```txt
┌─────────────────────────────────────────────────────┐
│                                                     │
│                 FOTOCORP PREVIEW                    │
│                                                     │
│  ‹                                           ›       │
│                                                     │
│     repeating watermark: fotocorp / fotokey          │
│                                                     │
│     bottom overlay: Fotocorp • [Photographer]        │
└─────────────────────────────────────────────────────┘
```

Use the current derivative strategy:

- **Card variant:** low-quality, fast browsing preview.
- **Detail variant:** larger watermarked image for detail page.
- **Original:** private, subscriber-gated, never exposed directly.

#### Suggested improvement

Fotocorp should improve on Getty in three ways:

1. **Reserved image aspect-ratio box** to prevent layout jumping.
2. **Zoom/lightbox preview** for logged-in or subscribed users if allowed.
3. **Clear unavailable state** when derivative generation failed.

Recommended preview state layout:

```txt
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Image preview unavailable                          │
│  We found the asset record, but preview generation   │
│  has not completed yet.                             │
│                                                     │
│  Fotokey: FC-12345                                  │
│  Status: derivative_missing                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

This is important because Fotocorp has migration/derivative realities that Getty does not expose.

---

### 3.5 Right Purchase / License Rail

```txt
┌──────────────────────┐
│ PURCHASE A LICENCE   │
├──────────────────────┤
│ Standard editorial   │
│ Custom rights        │
├──────────────────────┤
│ Size                 │
│ ○ Small   ₹7,000     │
│ ● Medium  ₹14,000    │
│ ○ Large   ₹23,000    │
├──────────────────────┤
│ ₹14,000 INR          │
│ [ADD TO BASKET]      │
│ [GET THIS IMAGE]     │
└──────────────────────┘
```

#### Getty behavior

- Strong commercial panel.
- Sticky-ish right rail.
- Size and rights selection are tied to price.
- Conversion happens without scrolling.

#### Fotocorp adaptation

Fotocorp should not copy this literally unless you sell single-image licenses. Replace it with an **Access Panel**.

```txt
┌──────────────────────┐
│ ACCESS THIS IMAGE    │
├──────────────────────┤
│ Preview              │
│ Watermarked          │
│ Available to all     │
├──────────────────────┤
│ Download             │
│ Requires subscription│
├──────────────────────┤
│ Your plan            │
│ [Active / Not active]│
│ Downloads left: 42   │
├──────────────────────┤
│ [DOWNLOAD IMAGE]     │
│ [SAVE TO FOTOBOX]    │
│ [VIEW PLANS]         │
└──────────────────────┘
```

#### States to support

##### Signed-out user

```txt
┌──────────────────────┐
│ ACCESS THIS IMAGE    │
├──────────────────────┤
│ Create an account to │
│ save and download.   │
├──────────────────────┤
│ [SIGN IN]            │
│ [VIEW PLANS]         │
└──────────────────────┘
```

##### Signed-in but not subscribed

```txt
┌──────────────────────┐
│ SUBSCRIPTION NEEDED  │
├──────────────────────┤
│ Preview available.   │
│ Downloads are locked.│
├──────────────────────┤
│ [VIEW PLANS]         │
│ [SAVE TO FOTOBOX]    │
└──────────────────────┘
```

##### Active subscriber

```txt
┌──────────────────────┐
│ READY TO DOWNLOAD    │
├──────────────────────┤
│ Plan: Editorial Pro  │
│ Downloads left: 42   │
├──────────────────────┤
│ Size                 │
│ ● Original           │
│ ○ Large preview      │
├──────────────────────┤
│ [DOWNLOAD]           │
│ [SAVE TO FOTOBOX]    │
└──────────────────────┘
```

##### Admin/internal/debug mode

```txt
┌──────────────────────┐
│ ASSET HEALTH         │
├──────────────────────┤
│ Original: mapped     │
│ Card: ready          │
│ Detail: ready        │
│ Fotokey: present     │
│ R2 key: present      │
└──────────────────────┘
```

#### Suggested improvement

Getty’s panel is price-first. Fotocorp should be **entitlement-first**:

```txt
Can this user download?
What version can they access?
What action should happen next?
```

---

### 3.6 Action Buttons Below the Image

```txt
┌─────────────────────────────────────────────────────┐
│                    [+ Save] [Comp] [Embed]          │
└─────────────────────────────────────────────────────┘
```

#### Getty behavior

- Secondary actions are under the image.
- Save and comp are buyer workflow tools.
- Embed supports editorial/news usage workflows.

#### Fotocorp adaptation

```txt
┌─────────────────────────────────────────────────────┐
│              [♡ Save to Fotobox] [Copy Fotokey]     │
│              [Share] [Report issue]                 │
└─────────────────────────────────────────────────────┘
```

Recommended actions:


| Action       | Keep?               | Fotocorp version                               |
| ------------ | ------------------- | ---------------------------------------------- |
| Save         | Yes                 | Save to Fotobox                                |
| Comp         | Maybe later         | Download watermarked comp if business needs it |
| Embed        | No, unless required | Avoid unless Fotocorp supports embeds          |
| Copy ID      | Yes                 | Copy Fotokey / asset ID                        |
| Share        | Yes                 | Copy public detail URL                         |
| Report issue | Yes                 | Useful during migration and metadata cleanup   |


#### Suggested improvement

Move critical actions into the right access panel and keep these as utility actions only. Avoid duplicate CTAs fighting each other.

---

### 3.7 Details Panel

```txt
┌──────────────────────┐
│ DETAILS              │
├──────────────────────┤
│ Credit               │
│ Editorial #          │
│ Collection           │
│ Date created         │
│ Upload date          │
│ Source               │
│ Object name          │
│ Max file size        │
└──────────────────────┘
```

#### Getty behavior

- Dense technical/legal metadata.
- Small typography.
- Placed on right side under purchase panel.
- Useful for professional buyers, but visually compressed.

#### Fotocorp adaptation

```txt
┌──────────────────────────────┐
│ DETAILS                      │
├──────────────────────────────┤
│ Fotokey        FC-2274242970 │
│ Category       Royalty       │
│ Event          Garden Party  │
│ Date           06 May 2026   │
│ Location       London        │
│ Photographer   [Name]        │
│ Copyright      Fotocorp      │
│ Source table   ImageBank     │
└──────────────────────────────┘
```

Only show fields that are real. Do not fabricate Getty-like metadata just to look “complete.” Empty metadata dressed in a tuxedo is still empty metadata.

#### Recommended visual treatment

Use definition-list styling:

```txt
DETAILS
────────────────────────
Fotokey        FC-12345
Event          Fashion Week
Category       Entertainment
Date           2024-02-19
Location       Mumbai
Photographer   Rahul S.
Copyright      Fotocorp
```

Better than a table because it remains readable on mobile.

#### Suggested improvement

Split details into three groups:

```txt
┌──────────────────────────────┐
│ IDENTIFICATION               │
│ Fotokey / Asset ID / Legacy  │
├──────────────────────────────┤
│ EDITORIAL CONTEXT            │
│ Title / caption / event/date │
├──────────────────────────────┤
│ RIGHTS & SOURCE              │
│ Copyright / photographer     │
└──────────────────────────────┘
```

This will feel more premium and less like a database dump.

---

### 3.8 More Images From This Event

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ More images from this event                                      View all >│
├───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬──────────┤
│ img   │ img   │ img   │ img   │ img   │ img   │ img   │ img   │ img      │
├───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴──────────┤
│ masonry / justified rows continue...                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Getty behavior

- Large related section keeps browsing alive.
- Uses event relationship as the primary recommendation logic.
- Layout is dense and editorial.
- This section is more useful than generic “related images.”

#### Fotocorp adaptation

Fotocorp should prioritize related content in this order:

1. Same event.
2. Same category.
3. Same location.
4. Same photographer.
5. Shared keywords.
6. Visually similar / AI later.

Recommended heading logic:

```txt
More from this event
More from [Category]
More by [Photographer]
Similar keywords
```

#### Suggested improvement

Use a **justified image grid** or masonry-like layout, but reserve dimensions before images load.

Bad behavior to avoid:

```txt
image loads late → pushes existing grid down → layout jumps → user rage
```

Correct behavior:

```txt
metadata knows width/height → grid reserves slot → image fades in → no push-down
```

Recommended card hover:

```txt
┌──────────────────────┐
│ image                │
│                      │
│ hover overlay:        │
│ Fotokey FC-12345      │
│ Save • View • Download│
└──────────────────────┘
```

Keep cards visually light. Fotocorp is image-first. Do not bury every thumbnail in heavy cards.

---

### 3.9 Video From This Event

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ Video from this event                                           View all > │
│ ┌────────────────────┐                                                   │
│ │ video thumbnail    │                                                   │
│ └────────────────────┘                                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Getty behavior

- If the event has video, Getty cross-sells video assets.

#### Fotocorp adaptation

Only include this if Fotocorp actually has video assets.

If not, replace with:

```txt
Related collections
Related categories
Recently viewed
More from this photographer
```

#### Suggested improvement

Do not render an empty video section. Empty sections are UX potholes.

---

### 3.10 Keyword Chips

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ [Arts Culture] [Beginnings] [British Royalty] [Buckingham Palace] ...      │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Getty behavior

- Keywords act as browsable taxonomy links.
- Chips create SEO/discovery paths.
- Good for users who think by topic instead of exact search query.

#### Fotocorp adaptation

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ Keywords                                                                   │
│ [Mumbai] [Bollywood] [Red Carpet] [Portrait] [Event] [Entertainment]       │
└────────────────────────────────────────────────────────────────────────────┘
```

Click behavior:

```txt
/ search?keyword=bollywood
/ search?category=entertainment
/ search?location=mumbai
```

#### Suggested improvement

Group chips by type if metadata supports it:

```txt
People       [Actor Name] [Politician Name]
Places       [Mumbai] [Bandra]
Topics       [Award Show] [Fashion]
Visuals      [Portrait] [Crowd] [Stage]
```

If metadata is messy, keep one simple keyword group for now. No fake sophistication.

---

### 3.11 Footer

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ Purple Getty footer                                                        │
│ Content | Solutions | Tools & Services | Company                           │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Getty behavior

- Heavy global footer.
- Strong brand color block.
- Lots of corporate links.

#### Fotocorp adaptation

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ FOTOCORP                                                                   │
│ Editorial archive • Licensing • Subscriptions • Contact                    │
│ Terms • Privacy • Copyright • Support                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Suggested improvement

Avoid copying Getty’s purple unless Fotocorp already owns that direction. A darker editorial footer would likely feel more premium.

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ black / charcoal footer                                                    │
│ white typography                                                           │
│ minimal columns                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Recommended Fotocorp Detail Page Layout

### 4.1 Desktop Layout

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ FOTOCORP                                                        Account    │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ 🔍 Search photos, events, people, places, Fotokey...                  │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┬──────────────────┤
│ Breadcrumb: Search / Entertainment / Event              │                  │
├─────────────────────────────────────────────────────────┤                  │
│ Headline / Title                                        │ ACCESS PANEL     │
│ Event • Location • Date                                 │                  │
│ Fotokey: FC-12345                                       │ Plan status      │
├─────────────────────────────────────────────────────────┤ Download CTA     │
│                                                         │ Save to Fotobox  │
│                  IMAGE PREVIEW STAGE                    │ Copy Fotokey     │
│                                                         │                  │
│        watermarked detail variant                       │                  │
│                                                         │                  │
├─────────────────────────────────────────────────────────┤                  │
│ Utility actions: Save / Share / Copy Fotokey            │                  │
├─────────────────────────────────────────────────────────┴──────────────────┤
│ Caption                                                                    │
│ Full editorial caption text if available                                   │
├────────────────────────────────────────────────────────────────────────────┤
│ Details                                                                    │
│ Identification | Editorial context | Rights/source                         │
├────────────────────────────────────────────────────────────────────────────┤
│ More from this event                                                       │
│ Dense image grid                                                           │
├────────────────────────────────────────────────────────────────────────────┤
│ Keywords                                                                   │
│ [chip] [chip] [chip]                                                       │
├────────────────────────────────────────────────────────────────────────────┤
│ Footer                                                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Mobile Layout

```txt
┌──────────────────────────────┐
│ FOTOCORP              Menu   │
├──────────────────────────────┤
│ 🔍 Search                    │
├──────────────────────────────┤
│ Headline / Title             │
│ Event • Date                 │
│ Fotokey: FC-12345            │
├──────────────────────────────┤
│                              │
│        IMAGE PREVIEW         │
│                              │
├──────────────────────────────┤
│ [Download / View plans]      │
│ [Save to Fotobox]            │
├──────────────────────────────┤
│ Caption                      │
├──────────────────────────────┤
│ Details accordion            │
├──────────────────────────────┤
│ More from this event         │
│ 2-column image grid          │
├──────────────────────────────┤
│ Keywords                     │
└──────────────────────────────┘
```

Mobile rule: the access panel must move directly below the image. Do not make users hunt for download.

---

## 5. Fotocorp Data Mapping

### 5.1 Ideal Detail Page Data Shape

```txt
AssetDetail
├── id
├── fotokey / legacy_imagecode
├── title / headline
├── caption
├── category
├── event
├── date_created
├── location
├── photographer
├── copyright
├── keywords[]
├── original_dimensions
├── variants
│   ├── thumb
│   ├── card
│   └── detail
├── entitlement
│   ├── can_preview
│   ├── can_download
│   ├── plan_name
│   └── quota_remaining
└── related_assets[]
```

### 5.2 Field Display Priority

```txt
Above image:
  1. Title / headline
  2. Event or category
  3. Date / location
  4. Fotokey

Beside image:
  1. Download/subscription status
  2. Save to Fotobox
  3. Copy Fotokey

Below image:
  1. Caption
  2. Full details
  3. Related images
  4. Keywords
```

### 5.3 When Data Is Missing

Do not show blank labels.

Bad:

```txt
Location:
Photographer:
Date:
```

Good:

```txt
Details
Fotokey        FC-12345
Category       Entertainment
Copyright      Fotocorp
```

If a field is missing, omit it. Let the page breathe.

---

## 6. Fotocorp Brand Direction for This Page

### 6.1 Design Personality

Fotocorp should feel:

- Editorial.
- Archival.
- Fast.
- Professional.
- Search-first.
- Copyright-safe.
- Premium without shouting.

Getty feels transactional. Fotocorp can feel more curated while still converting.

### 6.2 Typography

Use **Monument Grotesk** consistently if that is already the active brand direction.

Suggested hierarchy:

```txt
Page title/headline       20–28px, medium
Caption                   13–15px, regular
Metadata labels            11–12px, uppercase or muted
Metadata values            12–14px
CTA buttons                13–14px, medium
Related section headings   18–22px
```

### 6.3 Color System

Do not copy Getty’s purple footer blindly. Suggested editorial base:

```txt
Background        warm white / clean white
Primary text      near-black
Muted text        soft gray
Borders           pale neutral gray
Accent            Fotocorp brand accent only
CTA               dark solid or brand accent
Watermark         controlled opacity black/white depending image tone
```

Possible token structure:

```txt
--fc-bg:            #FFFFFF
--fc-bg-soft:       #F6F3EE
--fc-ink:           #111111
--fc-muted:         #6F6F6F
--fc-line:          #E6E1D8
--fc-panel:         #F7F5F0
--fc-accent:        brand-defined
--fc-accent-ink:    #FFFFFF
```

Use the actual existing Fotocorp brand tokens if they already exist in code.

---

## 7. UX Improvements Fotocorp Should Make Over Getty

### 7.1 Add a breadcrumb/back-to-search memory

Getty does not strongly preserve the user’s search context in the screenshot.

Fotocorp should show:

```txt
← Back to results for “Mumbai awards”
```

This matters because stock-photo users compare many assets quickly.

---

### 7.2 Keep the access panel sticky on desktop

```txt
┌──────────────────────┐
│ ACCESS THIS IMAGE    │  ← stays visible while user scrolls details
│ [DOWNLOAD]           │
└──────────────────────┘
```

Users should not scroll back to the top just to download.

---

### 7.3 Add copyable Fotokey everywhere it matters

Fotokey is a business-critical identifier. Make it easy to copy.

```txt
Fotokey: FC-12345  [Copy]
```

---

### 7.4 Use image dimensions for stable grids

Related grid must not jump while loading.

```txt
asset.width + asset.height → calculate aspect ratio → reserve slot → fade image in
```

This directly solves the “images pushing down while loading” problem.

---

### 7.5 Make derivative status visible internally

For admins only:

```txt
Original mapped: yes
Card preview: ready
Detail preview: ready
Watermark: applied
Last derivative generated: date/time
```

This will save debugging time during migration.

---

### 7.6 Add metadata quality indicators internally

For admins/editors:

```txt
Metadata score: 72/100
Missing: location, photographer
Keywords: 14
```

Do not show this to public users.

---

### 7.7 Related image logic should be explainable

Instead of generic “More images,” use headings based on actual relationship:

```txt
More from this event
More in Entertainment
More from Mumbai
More by this photographer
```

This makes browsing feel intentional, not random.

---

## 8. Proposed Component Structure

```txt
AssetDetailPage
├── DetailHeader
│   ├── LogoBar
│   └── SearchBar
├── AssetDetailShell
│   ├── AssetMainColumn
│   │   ├── BreadcrumbBackLink
│   │   ├── AssetTitleBlock
│   │   ├── AssetPreviewStage
│   │   ├── AssetUtilityActions
│   │   ├── AssetCaption
│   │   └── AssetMetadataSections
│   └── AssetAccessPanel
├── RelatedAssetsSection
│   ├── RelatedSectionHeader
│   └── JustifiedAssetGrid
├── KeywordChipsSection
└── SiteFooter
```

---

## 9. Recommended Page States

### 9.1 Normal public preview

```txt
Image visible
Watermark visible
Download locked
View plans CTA visible
Save requires sign-in
```

### 9.2 Subscriber preview

```txt
Image visible
Watermark visible
Download enabled
Quota/plan visible
Save enabled
```

### 9.3 Preview missing

```txt
Fallback panel visible
Asset metadata still visible
Admin sees derivative error
Public user sees calm unavailable message
```

### 9.4 Asset not found

```txt
404 page
Search bar visible
Suggested categories / recent assets visible
```

### 9.5 Metadata sparse

```txt
Show title/fotokey/category
Hide missing fields
Show keywords only if present
Related assets still work from category/event fallback
```

---

## 10. Interaction Details

### 10.1 Image viewer

```txt
Desktop:
  - Previous / next arrows on hover
  - Optional zoom button
  - Keyboard left/right navigation

Mobile:
  - Swipe left/right
  - Tap image for full-screen preview
```

### 10.2 Save to Fotobox

```txt
Signed out:
  click → sign-in prompt

Signed in:
  click → saved state
  label changes to "Saved"
```

### 10.3 Download

```txt
No subscription:
  click → plans/subscription page

Subscriber:
  click → internal API download route
  log download event
  decrement quota if applicable
```

### 10.4 Keyword chip

```txt
click chip → search results filtered by keyword
```

### 10.5 Related image

```txt
click image → detail page
preserve relation context in URL if possible
```

Example:

```txt
/photo/FC-12345?fromEvent=garden-party
```

---

## 11. SEO and Share Metadata

Each detail page should have strong metadata even if the actual image is protected.

```txt
<title>[Headline] | Fotocorp</title>
<meta name="description" content="[Caption or short metadata summary]">
<meta property="og:title" content="[Headline]">
<meta property="og:image" content="watermarked card/detail preview">
```

Do not expose originals in Open Graph images. Use watermarked preview only.

---

## 12. Performance Notes

```txt
Main image:
  - priority load detail variant
  - fixed aspect-ratio container
  - blur/neutral placeholder

Related grid:
  - lazy load below fold
  - reserve dimensions
  - virtualize only if grid becomes very large

Metadata:
  - server-render essential asset data
  - hydrate actions only where needed

Download:
  - never expose R2 secret or direct private key
  - route through server/internal API
```

---

## 13. Accessibility Notes

```txt
Image:
  alt = headline or caption summary

Buttons:
  visible labels, not icon-only

Keyboard:
  left/right arrows for previous/next asset
  tab order: search → image actions → access panel → metadata

Color:
  CTA contrast must pass accessibility checks

Watermark:
  should not make preview impossible to understand
```

---

## 14. Honest Critique of Getty’s Page

### What Getty does well

- The conversion rail is clear.
- Image context is immediately visible.
- Related event browsing is strong.
- Metadata gives professional trust.
- Keywords create good discovery paths.

### What Getty does poorly

- The right panel feels visually cramped.
- Metadata is dense and hard to scan.
- The purple footer is abrupt after the clean image layout.
- Search bar feels generic.
- The image area and commercial panel feel slightly disconnected.

### What Fotocorp should take

```txt
Take:
  - Big image stage
  - Right-side access rail
  - Related event grid
  - Keyword chips
  - Metadata trust layer

Do not blindly take:
  - Getty's exact pricing model
  - Purple footer
  - Dense metadata compression
  - Cart behavior unless Fotocorp has cart checkout
```

---

## 15. Final Recommended Fotocorp Page Blueprint

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ FOTOCORP                                                Fotobox | Account  │
├────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search photos, events, people, places, Fotokey...                       │
├─────────────────────────────────────────────────────────┬──────────────────┤
│ ← Back to results                                      │ ACCESS THIS IMAGE │
│                                                         │                  │
│ Headline / Title                                       │ Status: Preview   │
│ Event • Location • Date                                │ Plan: Required    │
│ Fotokey: FC-12345 [Copy]                               │                  │
│                                                         │ [View Plans]     │
│ ┌─────────────────────────────────────────────────────┐ │ [Save Fotobox]  │
│ │                                                     │ │ [Copy Fotokey]  │
│ │                WATERMARKED IMAGE                    │ │                  │
│ │                                                     │ │                  │
│ └─────────────────────────────────────────────────────┘ │                  │
│                                                         │                  │
│ [Save] [Share] [Copy Fotokey] [Report issue]           │                  │
├─────────────────────────────────────────────────────────┴──────────────────┤
│ Caption                                                                    │
│ A clean readable paragraph, not a tiny data dump.                          │
├────────────────────────────────────────────────────────────────────────────┤
│ Details                                                                    │
│ ┌────────────────────┬────────────────────┬─────────────────────────────┐ │
│ │ Identification     │ Editorial Context  │ Rights & Source             │ │
│ │ Fotokey            │ Event              │ Copyright                   │ │
│ │ Asset ID           │ Category           │ Photographer                │ │
│ │ Legacy source      │ Date / Location    │ Usage terms                 │ │
│ └────────────────────┴────────────────────┴─────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────┤
│ More from this event                                      View all          │
│ [dense image grid with reserved aspect-ratio slots]                         │
├────────────────────────────────────────────────────────────────────────────┤
│ Keywords                                                                   │
│ [Mumbai] [Entertainment] [Awards] [Portrait] [Event]                       │
├────────────────────────────────────────────────────────────────────────────┤
│ FOTOCORP footer                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 16. Implementation Acceptance Checklist

```txt
Layout
  [ ] Desktop uses two-column layout: image/content + sticky access panel
  [ ] Mobile stacks image, CTA panel, caption, details, related grid
  [ ] Search remains accessible without dominating the image

Image preview
  [ ] Detail variant loads in fixed aspect-ratio container
  [ ] Watermark is clearly visible
  [ ] No original R2 URL/key is exposed to browser
  [ ] Missing preview state is handled gracefully

Metadata
  [ ] Fotokey is visible and copyable
  [ ] Empty metadata fields are hidden
  [ ] Caption is readable
  [ ] Details are grouped into logical sections

Access/download
  [ ] Signed-out state works
  [ ] Non-subscriber state works
  [ ] Subscriber download state works
  [ ] Download goes through internal/protected API
  [ ] Download logging works

Related content
  [ ] Same-event images appear first when available
  [ ] Fallback relation logic exists
  [ ] Grid does not jump while images load
  [ ] Hover actions are useful but not noisy

Keywords
  [ ] Chips link back to filtered search
  [ ] Keyword overflow is handled

Brand
  [ ] Uses Fotocorp typography and spacing
  [ ] Does not copy Getty’s purple/footer blindly
  [ ] Feels editorial and premium, not template-ish
```

---

## 17. Bottom Line

Getty’s structure is worth studying because it solves the real stock-photo problem: **preview, trust, license, continue browsing**.

Fotocorp should replicate the **architecture of the experience**, not the exact skin.

The correct Fotocorp version should be:

```txt
Getty detail page logic
+ Fotocorp metadata reality
+ subscription entitlement model
+ stronger Fotokey visibility
+ cleaner editorial visual system
+ stable image loading
+ protected derivative delivery
= premium Fotocorp asset detail page
```

Build it cleanly. No fake Getty cosplay. The page should feel like Fotocorp owns its archive and knows exactly how professionals browse, save, and download images.