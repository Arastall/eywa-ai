"use strict";
/**
 * Eywa Score Calculation Service
 *
 * Computes a unified score (0-10) from multiple review sources.
 *
 * Formula:
 * eywaScore = (
 *   (google_rating * google_weight * google_confidence) +
 *   (tripadvisor_rating * tripadvisor_weight * ta_confidence)
 * ) / total_weight * 2  // Scale to 0-10
 *
 * Where confidence = min(1.0, review_count / 100)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateConfidence = calculateConfidence;
exports.calculateEywaScore = calculateEywaScore;
exports.calculateTrend = calculateTrend;
exports.formatEywaScore = formatEywaScore;
exports.getScoreColor = getScoreColor;
// Default weights (can be configured per hotel)
const DEFAULT_WEIGHTS = {
    google: 0.50,
    tripadvisor: 0.50,
};
// Review count threshold for full confidence
const CONFIDENCE_THRESHOLD = 100;
/**
 * Calculate confidence based on review count
 * More reviews = higher confidence (max 1.0 at 100+ reviews)
 */
function calculateConfidence(reviewCount) {
    return Math.min(1.0, reviewCount / CONFIDENCE_THRESHOLD);
}
/**
 * Calculate the Eywa Score from multiple rating sources
 */
function calculateEywaScore(sources) {
    const result = {
        eywaScore: 0,
        googleRating: null,
        googleWeight: DEFAULT_WEIGHTS.google,
        googleConfidence: 0,
        tripadvisorRating: null,
        tripadvisorWeight: DEFAULT_WEIGHTS.tripadvisor,
        tripadvisorConfidence: 0,
        sourcesUsed: [],
    };
    if (sources.length === 0) {
        return result;
    }
    let weightedSum = 0;
    let totalWeight = 0;
    for (const source of sources) {
        const weight = source.weight ?? DEFAULT_WEIGHTS[source.source] ?? 0.5;
        const confidence = calculateConfidence(source.reviewCount);
        const contribution = source.rating * weight * confidence;
        weightedSum += contribution;
        totalWeight += weight * confidence;
        result.sourcesUsed.push(source.source);
        if (source.source === 'google') {
            result.googleRating = source.rating;
            result.googleWeight = weight;
            result.googleConfidence = confidence;
        }
        else if (source.source === 'tripadvisor') {
            result.tripadvisorRating = source.rating;
            result.tripadvisorWeight = weight;
            result.tripadvisorConfidence = confidence;
        }
    }
    if (totalWeight > 0) {
        // Scale from 1-5 to 0-10
        result.eywaScore = Math.round((weightedSum / totalWeight) * 2 * 100) / 100;
    }
    return result;
}
/**
 * Calculate trend by comparing with previous score
 */
function calculateTrend(currentScore, previousScore) {
    if (previousScore === null) {
        return { trend: 'stable', delta: 0 };
    }
    const delta = Math.round((currentScore - previousScore) * 100) / 100;
    const threshold = 0.1; // Minimum change to be considered up/down
    if (delta > threshold) {
        return { trend: 'up', delta };
    }
    else if (delta < -threshold) {
        return { trend: 'down', delta };
    }
    else {
        return { trend: 'stable', delta };
    }
}
/**
 * Format Eywa score for display (e.g., "8.5")
 */
function formatEywaScore(score) {
    return score.toFixed(1);
}
/**
 * Get score color indicator (for UI)
 */
function getScoreColor(score) {
    if (score >= 8.0)
        return 'green';
    if (score >= 6.0)
        return 'yellow';
    if (score >= 4.0)
        return 'orange';
    return 'red';
}
