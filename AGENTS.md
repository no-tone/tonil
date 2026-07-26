## Project Constitution

This document defines the philosophy, design language, engineering standards, and decision-making principles for this project.

All agents, contributors, and future development tools should follow these guidelines when creating, modifying, or reviewing code.

The goal is not just to build features. The goal is to preserve a consistent product identity.

---

# Philosophy

## Core Values

Prioritize:

- Simplicity over cleverness
- Beautiful defaults over endless customization
- Fast over feature-rich
- Consistency over trends
- Removing features before adding unnecessary complexity

Every new feature should make the product feel lighter, clearer, and more intentional.

---

# Brand Personality

The product should feel like walking into a modern building in Porto:

- White walls
- Blue ceramic details
- Soft Atlantic daylight
- Quiet confidence
- Craftsmanship
- Architectural simplicity

The interface should never demand attention.

Every animation, color choice, interaction, and component decision should feel deliberate.

Portuguese identity should emerge through:

- proportion
- materials
- rhythm
- restraint

Avoid obvious cultural decoration.

---

# Design Philosophy

## Reference Inspirations

Use these products as inspiration:

- untitled.stream
- Linear
- Raycast
- Arc Browser
- Notion Calendar
- Apple Human Interface Guidelines

Do not copy them.

Study their principles:

- generous whitespace
- restrained typography
- subtle motion
- consistent spacing
- minimal UI chrome
- clear hierarchy
- intentional defaults

---

# Portuguese Identity

## Inspiration

Draw from:

- Azulejos
- Atlantic coastline
- White limestone
- Cobalt blue
- Natural sunlight
- Handmade craftsmanship
- Architectural minimalism

## Avoid

Do not use:

- Flags
- Tourism clichés
- Obvious cultural symbols
- Decorative tile patterns as wallpaper

## Instead

Use:

- Geometric rhythm
- Tile-inspired proportions
- Clean blue accents
- Subtle textures
- Architectural spacing

Portuguese influence should be felt, not displayed.

---

# Visual System

## Colors

Primary:
Azulejo Blue

Used for:
- interactions
- important states
- meaningful highlights

Blue is functional, not decorative.

Base:
Soft White

Neutrals:
- Warm Gray
- Stone
- Slate

Accent colors should be rare.

---

# Glass UI Philosophy

Glass should feel like real glass.

Never use glass simply because it is fashionable.

Rules:

- Low blur
- Low opacity
- Thin borders
- Realistic shadows
- Strong readability

Avoid:

- Neon glow
- Excessive transparency
- Decorative glass layers

Glass exists to separate information layers.

---

# Motion

Motion should be calm and intentional.

Animations should:

- Explain
- Guide
- Reinforce hierarchy

Never:

- Bounce
- Overshoot
- Spin unnecessarily
- Distract

Preferred timing:

150ms - 250ms

Preferred easing:

ease-out

Respect:

prefers-reduced-motion

---

# Components

Every component must answer:

"Why does this exist?"

If the answer is:

"It looks cool"

Remove it.

Prefer:

- ProjectCard
- UserAvatar
- SettingsPanel

Avoid:

- Thing
- Helper
- Utils2

Names should explain purpose.

---

# Typography

Preferred fonts:

- Geist
- Inter

Hierarchy should come from:

- spacing
- weight
- scale

Avoid excessive color usage.

---

# Icons

Use:

- Lucide icons

Rules:

- Icons support labels
- Icons should rarely exist alone
- Icons should communicate meaning

---

# Layout

Prefer:

- Large margins
- Generous spacing
- Few columns
- Comfortable reading widths
- Clear hierarchy

Avoid:

- Dense dashboards
- Clutter
- Excessive panels

---

# Accessibility

Everything must support:

- Keyboard navigation
- Screen readers
- Reduced motion preferences

Accessibility is a baseline requirement.

---

# Performance

Optimize by default.

Avoid unnecessary:

- Dependencies
- Re-renders
- Animations
- Network requests
- Abstractions

Measure before optimizing.

---

# Engineering Standards

## Language

Use:

- TypeScript only
- Strict mode enabled

Avoid:

any

Prefer:

- Explicit types
- Composition
- Small focused files
- Small components

---

# Validation

Use:

- Zod

Never trust:

- Client input
- External data
- API payloads

Validate at system boundaries.

---

# Database

Use:

- Drizzle ORM

Principles:

- Schema-first development
- Clear migrations
- Strong typing

Avoid raw SQL unless necessary.

---

# API

Use:

- Hono

Prefer REST conventions.

Examples:

GET /projects  
POST /projects  
PATCH /projects/:id  
DELETE /projects/:id

Routes should be predictable and consistent.

---

# Project Structure

Preferred:

apps/

packages/

Shared logic belongs inside packages.

Never duplicate business logic.

---

# Git Guidelines

Commits should be:

- Small
- Focused
- Meaningful

Never commit:

- Secrets
- API keys
- Environment credentials

---

# UI Quality Standard

Every screen should answer:

"Could this be mistaken for a polished product by a first-time visitor?"

If not:

1. Simplify
2. Remove unnecessary elements
3. Improve spacing
4. Refine hierarchy

---

# Decision Framework

When uncertain:

Prefer:

- Less UI
- Less complexity
- Fewer dependencies
- Clearer interactions
- Better defaults

Avoid:

- Feature creep
- Decorative complexity
- Trend-driven design

---

# Final Principle

The best interface is the one users stop noticing.

The product should feel:

- effortless
- intentional
- calm
- crafted

Every decision should move the product closer to that feeling.