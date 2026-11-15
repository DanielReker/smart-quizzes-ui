export function parseIsoDuration(durationStr: string | null | undefined): {
    hours: number;
    minutes: number;
    seconds: number;
} {
    if (!durationStr) {
        return { hours: 0, minutes: 0, seconds: 0 };
    }
    const regex = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i;
    const match = durationStr.match(regex);
    if (!match) {
        return { hours: 0, minutes: 0, seconds: 0 };
    }
    const days = match[1] ? parseInt(match[1], 10) : 0;
    const rawHours = match[2] ? parseInt(match[2], 10) : 0;
    const rawMinutes = match[3] ? parseInt(match[3], 10) : 0;
    const rawSeconds = match[4] ? Math.floor(parseFloat(match[4])) : 0;
    const totalSeconds = days * 86400 + rawHours * 3600 + rawMinutes * 60 + rawSeconds;
    return {
        hours: Math.floor(totalSeconds / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
    };
}

export function formatIsoDuration(hours: number, minutes: number, seconds: number): string | null {
    const totalSeconds = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
    if (totalSeconds < 1) {
        return null;
    }
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    let res = 'PT';
    if (h > 0) res += `${h}H`;
    if (m > 0) res += `${m}M`;
    if (s > 0) res += `${s}S`;
    return res === 'PT' ? null : res;
}

export function formatHumanDuration(hours: number, minutes: number, seconds: number): string {
    const totalSeconds = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
    if (totalSeconds < 1) {
        return '0 сек.';
    }
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h} ч.`);
    if (m > 0) parts.push(`${m} мин.`);
    if (s > 0) parts.push(`${s} сек.`);
    return parts.join(' ');
}

export function getTotalDurationSeconds(hours: number, minutes: number, seconds: number): number {
    return (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
}
