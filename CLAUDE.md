# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeCad Pro is a web-based 3D design and modeling application built with React, TypeScript, and Babylon.js. It features real-time 3D modeling, AI integration for natural language scene manipulation, and comprehensive tools for creating and editing 3D spaces.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production (runs TypeScript check then Vite build)
npm run build

# Run ESLint
npm run lint

# Preview production build
npm run preview

# Run tests (script needs to be added to package.json)
npm test
```

## Architecture Overview

### Core Technology Stack
- **React 19.1.0** with TypeScript for the UI
- **Babylon.js 8.15.1** for 3D graphics and rendering
- **Zustand 5.0.6** for state management with undo/redo middleware
- **Vite 7.0.0** as the build tool
- **TailwindCSS 4.1.11** for styling
- **OpenAI API** for AI-powered scene manipulation

### Key Directories

- `src/ai/` - AI service integration (OpenAI API)
- `src/babylon/` - 3D engine integration and factories
  - `sceneManager.ts` - Core 3D scene management
  - `movementController.ts` - WASD FPS-style movement
  - `objectFactory.ts` - 3D primitive creation
  - `housingFactory.ts` - Building components (walls, doors, windows)
- `src/components/` - React UI components
  - `chat/` - AI chat interface and voice input
  - `sidebar/` - AI panel, properties panel, scene hierarchy
  - `toolbar/` - Top menu and tools
- `src/state/` - Zustand stores
  - `sceneStore.ts` - Main application state
  - `undoMiddleware.ts` - Undo/redo functionality
- `src/services/` - Business logic (space analysis, layout generation)

### Key Architectural Patterns

1. **Hook-based Babylon.js Integration**: Custom hooks in `src/babylon/hooks/` bridge React and Babylon.js
2. **Factory Pattern**: Object creation via `objectFactory.ts` and `housingFactory.ts`
3. **Middleware Pattern**: Undo/redo implemented as Zustand middleware
4. **Service Layer**: Complex operations isolated in `src/services/`
5. **Movement System**: Frame-independent movement controller with configurable speed

## Testing

The project uses Jest for testing. Test files are located in `__tests__` directories:
- `src/__tests__/spaceOptimization.test.ts` - Space optimization algorithms
- `src/babylon/__tests__/movementController.test.ts` - Movement system

Note: Test script needs to be added to package.json: `"test": "jest"`

## TypeScript Configuration

- **Strict mode enabled** with all strict checks
- **Path alias**: `@/*` maps to `./src/*`
- **Target**: ES2022 for app code, ES2023 for Node
- **Module**: ESNext with bundler resolution
- **No unused locals/parameters** enforced

## AI Integration

The application integrates OpenAI's API for natural language scene manipulation:
- Service: `src/ai/ai.service.ts`
- UI: `src/components/chat/FloatingChatModal.tsx`
- Voice input: `src/components/ui/VoiceInputButton.tsx`

Environment variable required: `VITE_OPENAI_API_KEY`

## 3D Scene Management

The 3D scene is managed through:
- **Scene Store**: Central state in `src/state/sceneStore.ts`
- **Scene Manager**: Babylon.js integration in `src/babylon/sceneManager.ts`
- **Object Selection**: Multi-object selection with transform tools
- **Grid System**: Configurable grid with snapping
- **Materials**: Color picker and texture management system

## Performance Considerations

- Movement system uses deltaTime for frame-independent movement
- Throttled updates for performance-sensitive operations
- Texture caching and reuse in `textureManager.ts`
- Optimized for 60+ FPS operation