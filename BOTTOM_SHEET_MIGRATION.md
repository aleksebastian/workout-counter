# Bottom Sheet Migration Guide

## What Changed

Replaced modal dialogs with native mobile-style bottom sheets (drawers that slide up from the bottom nav bar). This provides a more app-like experience with touch-friendly interactions.

## Key Features

### BottomSheet Component
- **Sizes**: `small`, `medium`, `large`, `full` for different content needs
- **Swipe to dismiss**: Drag down >100px to close (primary method)
- **Backdrop tap**: Click/tap outside to close
- **Touch gestures**: Native feel with smooth animations
- **Backdrop blur**: iOS-style dimmed background
- **Keyboard support**: ESC to close, focus trap
- **Accessibility**: ARIA roles, tabindex management
- **No X button**: Follows native mobile patterns (iOS/Android)

### Migration Pattern

**Before (Dialog):**
```svelte
let dialog: HTMLDialogElement;
dialog.showModal();
if (dialog.returnValue === 'add') { ... }
```

**After (BottomSheet):**
```svelte
let open = $state(false);
open = true;
function handleSave(value) { ... }
```

## Migrated Components

✅ **NewWorkoutSheet** - Add new exercise (formerly NewWorkoutDialog)
- Used in: `/routes/exercises/+page.svelte`, `/routes/Drawer.svelte`
- Size: small (auto-height)
- Props: `open`, `newWorkoutName`, `onSave()`, `onCancel()`

✅ **NewRoutineSheet** - Add new routine (formerly NewRoutineDialog)
- Used in: `/routes/routines/+page.svelte`
- Size: small (auto-height)
- Props: `open`, `newRoutineName`, `onSave()`, `onCancel()`

✅ **NewProgramSheet** - Add new program (formerly NewProgramDialog)
- Used in: `/routes/programs/+page.svelte`
- Size: small (auto-height)
- Props: `open`, `newProgramName`, `onSave()`, `onCancel()`

✅ **EditSetSheet** - Edit set reps/weight (formerly EditSetDialog)
- Used in: `/routes/SetsHistoryTable.svelte`
- Size: small (auto-height)
- Props: `open`, `reps`, `weight`, `onSave()`, `onCancel()`

✅ **EditWorkoutSheet** - Edit/delete exercise (formerly EditWorkoutsDialog)
- Used in: `/routes/exercises/+page.svelte`, `/routes/Drawer.svelte`
- Size: small with inline delete confirmation
- Props: `open`, `editingWorkout`, `name`, `onSave()`, `onDelete()`, `onCancel()`

✅ **EditRoutineSheet** - Edit/delete routine (formerly EditRoutineDialog)
- Used in: `/routes/routines/+page.svelte`
- Size: small with inline delete confirmation
- Props: `open`, `editingRoutine`, `name`, `onSave()`, `onDelete()`, `onCancel()`

✅ **EditProgramSheet** - Edit/delete program (formerly EditProgramDialog)
- Used in: `/routes/programs/+page.svelte`
- Size: small with inline delete confirmation
- Props: `open`, `editingProgram`, `name`, `onSave()`, `onDelete()`, `onCancel()`

## Migration Complete! 🎉

All form dialogs have been migrated to mobile-native bottom sheets.

## Keep as Dialogs

⚠️ **ConfirmationDialog** - Destructive actions need modal emphasis
- Delete confirmations
- Critical warnings
- Error messages requiring acknowledgment

## Component API

```svelte
<BottomSheet 
  bind:open={isOpen}
  size="medium"
  title="Sheet Title"
  onClose={handleClose}
>
  <!-- Your form/content -->
  <div class="flex flex-col gap-4">
    <input class="input input-bordered" placeholder="Field..." />
    
    <!-- Cancel/Save buttons in footer -->
    <div class="flex gap-2">
      <button class="btn btn-ghost flex-1" onclick={handleCancel}>Cancel</button>
      <button class="btn btn-primary flex-1" onclick={handleSave}>Save</button>
    </div>
  </div>
</BottomSheet>
```

### Dismiss Methods (in order of preference)
1. **Swipe down** - Primary mobile method (drag handle >100px)
2. **Cancel button** - Explicit action in form footer
3. **Backdrop tap** - Quick exit without saving
4. **ESC key** - Desktop keyboard users

## Best Practices

1. **Auto-focus** first input when sheet opens
2. **Clear state** on close/cancel
3. **Validation** before allowing save
4. **Loading states** during async operations
5. **Safe area** handling for notched devices
6. **One sheet at a time** - don't stack sheets
7. **Always include Cancel/Save buttons** for forms with user input
8. **Button placement** - Actions in footer, not header (follows mobile native patterns)

## Animation Details

- **Open**: 350ms cubic-bezier spring from bottom
- **Close**: 200ms fade + fly
- **Touch drag**: Real-time transform tracking
- **Backdrop**: Blur + 40% black overlay

## Z-Index Hierarchy

```
z-1000: BottomSheet overlay
z-500: BottomNav (always on top)
z-70: FAB
z-60: RestTimerBar
```
