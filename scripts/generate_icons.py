"""
CLAG Downloader - High-Energy Cyber-Neon Icon Generator
Generates a stunning, lively, hyper-speed futuristic icon across all sizes.
Features:
- Multi-layer luminous particle rings and orbital cyber arcs
- 3D supersonic energy arrow with laser core and faceted wings
- Bottom sonic accelerator wave
- Multi-resolution ICO embedding (16, 32, 48, 64, 128, 256)
Author: Wael Sayed
"""

import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_lively_icon(size: int) -> Image.Image:
    # 4x internal supersampling for flawless antialiasing and sub-pixel glow
    scale = 4 if size <= 64 else 2
    canvas_size = size * scale
    cx = canvas_size / 2.0
    cy = canvas_size / 2.0

    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Multi-tier Holographic Aura Glow
    base_radius = canvas_size * 0.44
    glow_steps = 20
    for i in range(glow_steps, 0, -1):
        g_r = base_radius + (i * 2.8 * (scale / 2.0))
        pct = i / glow_steps
        alpha = int(22 * (1.0 - pct))
        # Color shifting gradient: Cyan -> Magenta -> Electric Purple
        r = int(0 * (1 - pct) + 168 * pct)
        g = int(240 * (1 - pct) + 85 * pct)
        b = int(255 * (1 - pct) + 247 * pct)
        draw.ellipse(
            [cx - g_r, cy - g_r, cx + g_r, cy + g_r],
            outline=(r, g, b, alpha),
            width=max(1, int(3 * (scale / 2.0)))
        )

    # 2. Main Squircle Cyber Badge (Cosmic Dark Glass)
    corner_r = int(canvas_size * 0.25)
    pad = int(canvas_size * 0.07)
    w_box = [pad, pad, canvas_size - pad, canvas_size - pad]

    # Deep Space Navy-Black background
    draw.rounded_rectangle(
        w_box,
        radius=corner_r,
        fill=(8, 12, 28, 255),
        outline=(0, 240, 255, 230),
        width=max(2, int(3.5 * (scale / 2.0)))
    )

    # Secondary inner neon border (Magenta / Purple)
    inner_pad = pad + max(2, int(3.5 * (scale / 2.0)))
    draw.rounded_rectangle(
        [inner_pad, inner_pad, canvas_size - inner_pad, canvas_size - inner_pad],
        radius=max(4, corner_r - int(3 * (scale / 2.0))),
        outline=(168, 85, 247, 160),
        width=max(1, int(1.8 * (scale / 2.0)))
    )

    # 3. Dynamic Orbital Energy Rings (Angled particle ellipses)
    orbit_w = canvas_size * 0.38
    orbit_h = canvas_size * 0.16
    draw.ellipse(
        [cx - orbit_w, cy + canvas_size * 0.08 - orbit_h, cx + orbit_w, cy + canvas_size * 0.08 + orbit_h],
        outline=(0, 240, 255, 120),
        width=max(1, int(2.0 * (scale / 2.0)))
    )
    draw.ellipse(
        [cx - orbit_w * 0.85, cy + canvas_size * 0.16 - orbit_h * 0.75, cx + orbit_w * 0.85, cy + canvas_size * 0.16 + orbit_h * 0.75],
        outline=(236, 72, 153, 150),
        width=max(1, int(2.2 * (scale / 2.0)))
    )

    # 4. Energy Lightning & Velocity Particles
    particles = [
        (-canvas_size * 0.28, -canvas_size * 0.18, 2.5, (0, 240, 255, 220)),
        (canvas_size * 0.27, -canvas_size * 0.20, 2.0, (236, 72, 153, 220)),
        (-canvas_size * 0.30, canvas_size * 0.15, 3.0, (168, 85, 247, 200)),
        (canvas_size * 0.31, canvas_size * 0.14, 2.8, (0, 240, 255, 200)),
        (-canvas_size * 0.15, -canvas_size * 0.30, 2.0, (255, 255, 255, 240)),
        (canvas_size * 0.16, -canvas_size * 0.28, 2.5, (0, 240, 255, 240)),
    ]
    for px, py, pr, pcolor in particles:
        pr_scaled = max(1, int(pr * (scale / 2.0)))
        draw.ellipse([cx + px - pr_scaled, cy + py - pr_scaled, cx + px + pr_scaled, cy + py + pr_scaled], fill=pcolor)

    # 5. Master Supersonic Download Arrow
    # Proportions
    arrow_w = canvas_size * 0.23
    shaft_w = canvas_size * 0.10
    top_y = canvas_size * 0.19
    head_y = canvas_size * 0.50
    tip_y = canvas_size * 0.74

    # A. Wide Vibrant Outer Glow
    outer_glow_poly = [
        (cx, tip_y + int(6 * (scale / 2.0))),
        (cx - arrow_w - int(6 * (scale / 2.0)), head_y),
        (cx - shaft_w - int(4 * (scale / 2.0)), head_y),
        (cx - shaft_w - int(4 * (scale / 2.0)), top_y - int(4 * (scale / 2.0))),
        (cx + shaft_w + int(4 * (scale / 2.0)), top_y - int(4 * (scale / 2.0))),
        (cx + shaft_w + int(4 * (scale / 2.0)), head_y),
        (cx + arrow_w + int(6 * (scale / 2.0)), head_y),
    ]
    draw.polygon(outer_glow_poly, fill=(0, 240, 255, 90))

    # B. Left Wing (Cyan Electric)
    left_wing = [
        (cx, tip_y),
        (cx - arrow_w, head_y),
        (cx - shaft_w, head_y),
        (cx - shaft_w, top_y),
        (cx, top_y),
        (cx, tip_y)
    ]
    draw.polygon(left_wing, fill=(0, 210, 255, 255))

    # C. Right Wing (Electric Violet / Purple-Blue Shading)
    right_wing = [
        (cx, tip_y),
        (cx, top_y),
        (cx + shaft_w, top_y),
        (cx + shaft_w, head_y),
        (cx + arrow_w, head_y),
        (cx, tip_y)
    ]
    draw.polygon(right_wing, fill=(34, 150, 245, 255))

    # D. Faceted Wing Accents (Neon Highlights on Wing Edges)
    draw.line([(cx - arrow_w, head_y), (cx, tip_y)], fill=(200, 255, 255, 255), width=max(1, int(2 * (scale / 2.0))))
    draw.line([(cx + arrow_w, head_y), (cx, tip_y)], fill=(168, 85, 247, 255), width=max(1, int(2 * (scale / 2.0))))
    draw.line([(cx - shaft_w, top_y), (cx + shaft_w, top_y)], fill=(255, 255, 255, 240), width=max(1, int(1.5 * (scale / 2.0))))

    # E. White-Hot Quantum Energy Core Beam
    core_w = shaft_w * 0.42
    core_head = arrow_w * 0.40
    core_poly = [
        (cx, tip_y - int(9 * (scale / 2.0))),
        (cx - core_head, head_y - int(4 * (scale / 2.0))),
        (cx - core_w, head_y - int(4 * (scale / 2.0))),
        (cx - core_w, top_y + int(6 * (scale / 2.0))),
        (cx + core_w, top_y + int(6 * (scale / 2.0))),
        (cx + core_w, head_y - int(4 * (scale / 2.0))),
        (cx + core_head, head_y - int(4 * (scale / 2.0))),
    ]
    draw.polygon(core_poly, fill=(255, 255, 255, 255))

    # 6. High-Frequency Sonic Accelerator Wave (Bottom)
    bar_y1 = canvas_size * 0.80
    bar_h = max(2, int(3.2 * (scale / 2.0)))
    
    # Upper accelerator bar (Neon Violet)
    draw.rounded_rectangle(
        [cx - canvas_size * 0.30, bar_y1, cx + canvas_size * 0.30, bar_y1 + bar_h],
        radius=int(bar_h / 2),
        fill=(168, 85, 247, 245)
    )
    # Lower accelerator bar (Hot Cyan)
    bar_y2 = bar_y1 + int(6.5 * (scale / 2.0))
    draw.rounded_rectangle(
        [cx - canvas_size * 0.20, bar_y2, cx + canvas_size * 0.20, bar_y2 + bar_h],
        radius=int(bar_h / 2),
        fill=(0, 240, 255, 255)
    )

    # Downsample cleanly with Lanczos interpolation
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    pub_icons = os.path.join(base_dir, "public", "icons")
    ext_icons = os.path.join(base_dir, "extension", "icons")
    os.makedirs(pub_icons, exist_ok=True)
    os.makedirs(ext_icons, exist_ok=True)

    sizes = {
        os.path.join(pub_icons, "icon-192.png"): 192,
        os.path.join(pub_icons, "icon-512.png"): 512,
        os.path.join(ext_icons, "icon-16.png"): 16,
        os.path.join(ext_icons, "icon-32.png"): 32,
        os.path.join(ext_icons, "icon-48.png"): 48,
        os.path.join(ext_icons, "icon-128.png"): 128,
    }

    print("Generating fantastic lively cyber-neon PNG icons...")
    for path, sz in sizes.items():
        img = create_lively_icon(sz)
        img.save(path, format="PNG")
        print(f"Generated: {path} ({sz}x{sz})")

    # Generate multi-resolution ICO for Windows / Favicon
    ico_path = os.path.join(base_dir, "public", "favicon.ico")
    print(f"Generating multi-resolution ICO at: {ico_path}...")
    ico_256 = create_lively_icon(256)
    ico_128 = create_lively_icon(128)
    ico_64 = create_lively_icon(64)
    ico_48 = create_lively_icon(48)
    ico_32 = create_lively_icon(32)
    ico_16 = create_lively_icon(16)
    
    ico_256.save(
        ico_path,
        format="ICO",
        append_images=[ico_128, ico_64, ico_48, ico_32, ico_16]
    )
    print(f"Generated multi-resolution ICO (16, 32, 48, 64, 128, 256) at: {ico_path}")
    print("\nAll lively icons successfully generated!")

if __name__ == "__main__":
    main()
