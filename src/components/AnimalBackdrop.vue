<script setup lang="ts">
import decorLeaf from '@/assets/images/animal/decor-leaf.svg'
import decorButterfly from '@/assets/images/animal/decor-butterfly.svg'
import decorCloud from '@/assets/images/animal/decor-cloud.svg'
</script>

<template>
  <div class="animal-backdrop" aria-hidden="true">
    <div class="animal-backdrop__glow animal-backdrop__glow--sky" />
    <div class="animal-backdrop__glow animal-backdrop__glow--meadow" />
    <img class="animal-backdrop__sprite animal-backdrop__sprite--cloud" :src="decorCloud" alt="" />
    <img class="animal-backdrop__sprite animal-backdrop__sprite--leaf" :src="decorLeaf" alt="" />
    <img class="animal-backdrop__sprite animal-backdrop__sprite--butterfly" :src="decorButterfly" alt="" />
  </div>
</template>

<style scoped>
.animal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.animal-backdrop__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(48px);
}

.animal-backdrop__glow--sky {
  top: -8%;
  right: 10%;
  width: min(420px, 55vw);
  height: min(280px, 40vh);
  background: radial-gradient(circle, rgba(130, 213, 187, 0.28) 0%, transparent 70%);
}

.animal-backdrop__glow--meadow {
  bottom: -6%;
  left: 18%;
  width: min(380px, 50vw);
  height: min(240px, 35vh);
  background: radial-gradient(circle, rgba(111, 186, 44, 0.16) 0%, transparent 72%);
}

.animal-backdrop__sprite {
  position: absolute;
  user-select: none;
  -webkit-user-drag: none;
}

.animal-backdrop__sprite--cloud {
  top: 6%;
  right: 8%;
  width: min(200px, 22vw);
  opacity: 0.55;
  animation: animal-float-slow 14s ease-in-out infinite;
}

.animal-backdrop__sprite--leaf {
  top: 14%;
  left: 4%;
  width: min(100px, 11vw);
  opacity: 0.42;
  animation: animal-float-slow 11s ease-in-out infinite reverse;
}

.animal-backdrop__sprite--butterfly {
  bottom: 28%;
  left: 10%;
  width: min(64px, 7vw);
  opacity: 0.5;
  animation: animal-flutter 6s ease-in-out infinite;
}

@keyframes animal-float-slow {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@keyframes animal-flutter {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  33% {
    transform: translate(4px, -8px) rotate(4deg);
  }
  66% {
    transform: translate(-3px, -4px) rotate(-3deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .animal-backdrop__sprite {
    animation: none;
  }
}
</style>
