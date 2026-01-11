import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: ['class', 'class'],
    theme: {
        extend: {
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                surface: {
                    DEFAULT: 'hsl(var(--surface))',
                    elevated: 'hsl(var(--surface-elevated))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                ring: 'hsl(var(--ring))',
                track: {
                    drums: 'hsl(var(--track-drums))',
                    bass: 'hsl(var(--track-bass))',
                    keys: 'hsl(var(--track-keys))',
                    melody: 'hsl(var(--track-melody))',
                    vocals: 'hsl(var(--track-vocals))',
                    fx: 'hsl(var(--track-fx))'
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                input: 'hsl(var(--input))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                }
            },
            fontFamily: {
                sans: [
                    'var(--font-inter)',
                    'ui-sans-serif',
                    'system-ui',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    '"Segoe UI"',
                    'Roboto',
                    '"Helvetica Neue"',
                    'Arial',
                    'sans-serif'
                ],
                mono: [
                    'var(--font-mono)',
                    'ui-monospace',
                    'SFMono-Regular',
                    '"SF Mono"',
                    'Menlo',
                    'Consolas',
                    '"Liberation Mono"',
                    'monospace'
                ]
            },
            fontSize: {
                '2xs': [
                    '0.625rem',
                    {
                        lineHeight: '0.75rem'
                    }
                ]
            },
            spacing: {
                transport: '48px',
                browser: '240px',
                inspector: '260px',
                editor: '35vh'
            },
            transitionDuration: {
                '120': '120ms',
                '150': '150ms',
                '160': '160ms'
            },
            animation: {
                'pulse-beat': 'pulse-beat 0.5s ease-in-out',
                'slide-up': 'slide-up 150ms ease-out',
                'slide-down': 'slide-down 150ms ease-out',
                glow: 'glow 2s ease-in-out infinite'
            },
            keyframes: {
                'pulse-beat': {
                    '0%, 100%': {
                        opacity: '1'
                    },
                    '50%': {
                        opacity: '0.7'
                    }
                },
                'slide-up': {
                    '0%': {
                        transform: 'translateY(100%)'
                    },
                    '100%': {
                        transform: 'translateY(0)'
                    }
                },
                'slide-down': {
                    '0%': {
                        transform: 'translateY(0)'
                    },
                    '100%': {
                        transform: 'translateY(100%)'
                    }
                },
                glow: {
                    '0%, 100%': {
                        boxShadow: '0 0 5px currentColor'
                    },
                    '50%': {
                        boxShadow: '0 0 20px currentColor'
                    }
                }
            },
            boxShadow: {
                clip: '0 2px 8px rgba(0, 0, 0, 0.3)',
                'clip-selected': '0 0 0 2px hsl(var(--accent)), 0 4px 12px rgba(0, 0, 0, 0.4)',
                elevated: '0 4px 16px rgba(0, 0, 0, 0.5)'
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
};

export default config;
