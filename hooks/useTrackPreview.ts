// ============================================
// ComposeYogi — Editor Preview Hook
// ============================================
//
// Points the shared preview voice at the track a clip belongs to, and hands the
// editor a function to audition a pitch.
//
// The voice is built when the editor opens rather than on the first click, so
// the click itself is instant — a sampler kit has buffers to fetch, and waiting
// for them under the pointer is the difference between an instrument and a
// web page.

import { useCallback, useEffect, useMemo } from 'react';

import { previewVoice } from '@/lib/audio/preview-voice';
import { useProjectStore, useUIStore } from '@/lib/store';

import type { Clip } from '@/types';

/**
 * Audition notes through a clip's own track.
 *
 * Returns a `preview(pitch, velocity?)`. Velocity defaults to the editor's
 * default-velocity control, so an auditioned note lands as hard as the note the
 * click is about to create.
 */
export function useTrackPreview(clip: Clip | null) {
    const tracks = useProjectStore((s) => s.project?.tracks);
    const defaultVelocity = useUIStore((s) => s.defaultVelocity);

    const track = useMemo(
        () => tracks?.find((t) => t.id === clip?.trackId) ?? null,
        [tracks, clip?.trackId]
    );

    // Rebuild when the track's *instrument* changes, not on every project edit:
    // `track` is a new object after any change to it, and re-running this on a
    // volume drag would rebuild a sampler mid-gesture.
    const preset = track?.instrumentPreset;

    useEffect(() => {
        void previewVoice.prepare(track ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [track?.id, preset]);

    // Tear the voice down when the editor closes, so a synth is not left in the
    // graph pointed at a track the user is no longer editing.
    useEffect(() => () => previewVoice.dispose(), []);

    return useCallback(
        (pitch: number, velocity?: number) => {
            void previewVoice.play(track, pitch, velocity ?? defaultVelocity);
        },
        [track, defaultVelocity]
    );
}
