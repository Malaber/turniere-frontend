import { type Page } from '@playwright/test';

export async function installBeamerEffectSpies(page: Page) {
  await page.addInitScript(() => {
    (window as any).__beamerAudioEvents = [];
    (window as any).__beamerAudioUnlocked = false;

    const markAudioUnlocked = () => {
      (window as any).__beamerAudioUnlocked = true;
    };
    window.addEventListener('click', markAudioUnlocked, { capture: true });
    window.addEventListener('pointerup', markAudioUnlocked, { capture: true });
    window.addEventListener('touchend', markAudioUnlocked, { capture: true });

    class FakeAudio {
      src: string;
      preload = '';
      volume = 1;
      currentTime = 0;
      muted = false;
      readyState = 1;

      constructor(src: string) {
        this.src = src;
        (window as any).__beamerAudioEvents.push({ type: 'audio-created', src });
      }

      play() {
        if (
          (window as any).__blockBeamerAudioUntilInteraction &&
          !(window as any).__beamerAudioUnlocked &&
          !this.muted
        ) {
          (window as any).__beamerAudioEvents.push({
            type: 'audio-blocked',
            src: this.src,
            currentTime: this.currentTime,
          });
          return Promise.reject(new Error('NotAllowedError'));
        }

        (window as any).__beamerAudioEvents.push({
          type: 'audio-play',
          src: this.src,
          currentTime: this.currentTime,
          muted: this.muted,
          volume: this.volume,
        });
        return Promise.resolve();
      }

      pause() {
        (window as any).__beamerAudioEvents.push({
          type: 'audio-pause',
          src: this.src,
          currentTime: this.currentTime,
        });
      }

      load() {
        (window as any).__beamerAudioEvents.push({ type: 'audio-load', src: this.src });
      }

      addEventListener(eventName: string, callback: () => void) {
        if (['loadedmetadata', 'seeked', 'canplay'].includes(eventName)) {
          callback();
        }
      }
    }

    (window as any).Audio = FakeAudio;
  });
}

export async function countBeamerEffects(page: Page, type: string, cue?: string): Promise<number> {
  return page.evaluate(
    ({ expectedType, expectedCue }) => {
      const events = (window as any).__beamerTimerEffects?.events || [];

      return events.filter((event) => {
        if (event.type !== expectedType) return false;
        if (!expectedCue) return true;
        return event.cue === expectedCue;
      }).length;
    },
    { expectedType: type, expectedCue: cue },
  );
}

export async function waitForBeamerEffect(
  page: Page,
  type: string,
  cue?: string,
  minimum = 1,
  timeout = 8_000,
) {
  await page.waitForFunction(
    ({ expectedType, expectedCue, expectedMinimum }) => {
      const events = (window as any).__beamerTimerEffects?.events || [];

      return events.filter((event) => {
        if (event.type !== expectedType) return false;
        if (!expectedCue) return true;
        return event.cue === expectedCue;
      }).length >= expectedMinimum;
    },
    { expectedType: type, expectedCue: cue, expectedMinimum: minimum },
    { timeout },
  );
}
