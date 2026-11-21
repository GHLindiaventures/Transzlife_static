import { Zap, Wind, Leaf, Droplet, Flower2, CigaretteOff, Sparkles } from 'lucide-react';

// Data-driven icons (concerns). Explicit map keeps the bundle small.
const MAP = { Zap, Wind, Leaf, Droplet, Flower2, CigaretteOff, Sparkles };

export default function Icon({ name, size = 22, ...rest }) {
  const C = MAP[name] || Leaf;
  return <C size={size} strokeWidth={1.7} aria-hidden="true" {...rest} />;
}
