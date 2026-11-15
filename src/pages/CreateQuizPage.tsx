import {useState} from 'react';
import {Alert, Box, Button, CircularProgress, Snackbar, Typography} from '@mui/material';
import {useCreateQuiz} from '../api/generated';
import type {QuizCreateRequest} from '../api/generated/model';
import {useNavigate} from 'react-router';
import {QuizSettingsFields, type QuizSettingsData} from '../components/QuizSettingsFields';
import {formatIsoDuration, getTotalDurationSeconds} from '../utils/duration';
import * as React from "react";

export const CreateQuizPage = () => {
    const navigate = useNavigate();
    const {mutateAsync: createQuiz, isPending: isCreating} = useCreateQuiz();

    const [settings, setSettings] = useState<QuizSettingsData>({
        name: '',
        description: '',
        allowAnonymous: false,
        hasAttemptsLimit: false,
        maxAttempts: 1,
        hasTimeLimit: false,
        timeHours: 0,
        timeMinutes: 15,
        timeSeconds: 0,
    });

    const [notification, setNotification] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error';
    }>({
        open: false,
        message: '',
        severity: 'success'
    });

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!settings.name.trim()) {
            setNotification({
                open: true,
                message: 'Укажите название теста',
                severity: 'error'
            });
            return;
        }

        if (settings.hasAttemptsLimit && (!settings.maxAttempts || settings.maxAttempts < 1)) {
            setNotification({
                open: true,
                message: 'Количество попыток должно быть не меньше 1',
                severity: 'error'
            });
            return;
        }

        if (
            settings.hasTimeLimit &&
            getTotalDurationSeconds(settings.timeHours, settings.timeMinutes, settings.timeSeconds) < 1
        ) {
            setNotification({
                open: true,
                message: 'Время на прохождение должно быть не менее 1 секунды',
                severity: 'error'
            });
            return;
        }

        const payload: QuizCreateRequest = {
            name: settings.name.trim(),
            description: settings.description.trim() ? settings.description.trim() : null,
            allowAnonymous: settings.allowAnonymous,
            maxAttempts: settings.hasAttemptsLimit
                ? Math.max(1, Math.floor(Number(settings.maxAttempts)))
                : null,
            timeToComplete: settings.hasTimeLimit
                ? formatIsoDuration(settings.timeHours, settings.timeMinutes, settings.timeSeconds)
                : null,
        };

        try {
            const newQuiz = await createQuiz({ data: payload });
            navigate(`/quizzes/${newQuiz.id}/edit`);
        } catch {
            setNotification({
                open: true,
                message: 'Ошибка при создании теста',
                severity: 'error'
            });
        }
    };

    return (
        <Box maxWidth="sm" sx={{ mx: 'auto', pb: 6 }}>
            <Typography variant="h5" gutterBottom fontWeight={600}>
                Новый тест
            </Typography>

            <form onSubmit={handleSubmit}>
                <QuizSettingsFields
                    values={settings}
                    onChange={setSettings}
                    disabled={isCreating}
                />

                <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    sx={{ mt: 3 }}
                    disabled={isCreating}
                >
                    {isCreating ? <CircularProgress size={24} color="inherit" /> : 'Создать тест'}
                </Button>
            </form>

            <Snackbar
                open={notification.open}
                autoHideDuration={5000}
                onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
                    severity={notification.severity}
                    sx={{ width: '100%', boxShadow: 3 }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};