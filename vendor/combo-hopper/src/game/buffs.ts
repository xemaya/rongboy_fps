// Re-export from the registry for backward compatibility.
// New code should import from './registries/buffs' directly.
export { BUFFS, BUFF_REGISTRY, getBuff, buffById } from './registries/buffs';
export type { BuffDef, BuffHook } from './registries/buffs';
