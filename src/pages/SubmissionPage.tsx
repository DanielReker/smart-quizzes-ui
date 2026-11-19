import {useCallback, useEffect, useRef, useState} from 'react';
import {useNavigate, useParams} from 'react-router';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    LinearProgress,
    Paper,
    Snackbar,
    Stack,
    Typography
} from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {useQueryClient} from '@tanstack/react-query';
import {
    getGetSubmissionQueryKey,
    useFinishSubmission,
    useGetQuizShort,
    useGetSubmission,
    useRevealHint,
    useSubmitAnswers
} from '../api/generated';
import type {
    AnswerResponseObjectVariant,
    AnswersSubmitRequest,
    AnswerSubmitRequestVariant
} from '../api/generated/model';
import {
    type AnswerValueState,
    SubmissionAnswerCard
} from '../components/questions/SubmissionAnswerCard.tsx';
import {
    getTotalDurationSeconds,
    parseIsoDuration
} from '../utils/duration.ts';

export const SubmissionPage = () => {
    const { submissionId } = useParams<{ submissionId: string }>();

    if (!submissionId) {
        throw new Error('Missing submissionId param');
    }

    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [isTimeExpired, setIsTimeExpired] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

    const [userEdits, setUserEdits] = useState<Record<string, AnswerValueState>>({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [finishDialogOpen, setFinishDialogOpen] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);

    const [hintDialogState, setHintDialogState] = useState<{
        open: boolean;
        answerId: string | null;
        penalty: number;
        remainingCount: number;
    }>({
        open: false,
        answerId: null,
        penalty: 0,
        remainingCount: 0
    });

    const [notification, setNotification] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info';
    }>({
        open: false,
        message: '',
        severity: 'info'
    });

    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const userEditsRef = useRef(userEdits);

    useEffect(() => {
        userEditsRef.current = userEdits;
    }, [userEdits]);

    const {
        data: submission,
        isLoading: isSubmissionLoading,
        error: submissionError
    } = useGetSubmission(submissionId, {
        query: {
            enabled: Boolean(submissionId),
            refetchInterval: (query) => {
                const s = query.state.data?.status;
                if (s === 'FINISHED') {
                    return false;
                }
                if (s === 'SCORING' || s === 'COMPLETING' || isTimeExpired) {
                    return 1500;
                }
                return false;
            },
            refetchIntervalInBackground: true
        }
    });

    const { data: shortQuiz } = useGetQuizShort(submission?.quizId || '', {
        query: {
            enabled: Boolean(submission?.quizId)
        }
    });

    const { mutateAsync: submitAnswersMutation } = useSubmitAnswers();
    const { mutateAsync: finishSubmissionMutation } = useFinishSubmission();
    const { mutateAsync: revealHintMutation, isPending: isRevealingHint } = useRevealHint();

    const isBlocked =
        isTimeExpired ||
        (submission?.status !== undefined && submission.status !== 'IN_PROCESS');

    const getAnswerValue = useCallback(
        (q: AnswerResponseObjectVariant, edits = userEdits): AnswerValueState => {
            if (edits[q.id]) {
                return edits[q.id];
            }
            if (q.dtype === 'single-choice') {
                return { selectedChoiceId: q.selectedChoiceId ?? null };
            }
            if (q.dtype === 'multi-choice') {
                return { selectedChoiceIds: q.selectedChoiceIds ?? [] };
            }
            if (q.dtype === 'text') {
                return { value: q.value ?? '' };
            }
            return {};
        },
        [userEdits]
    );

    const buildSubmitPayload = useCallback(
        (edits: Record<string, AnswerValueState>): AnswersSubmitRequest => {
            if (!submission?.answers) {
                return { answers: [] };
            }

            const answers: AnswerSubmitRequestVariant[] = [];

            submission.answers.forEach((q) => {
                const state = getAnswerValue(q, edits);

                if (q.dtype === 'single-choice') {
                    if (state.selectedChoiceId) {
                        answers.push({
                            answerId: q.id,
                            dtype: 'single-choice',
                            selectedChoiceId: state.selectedChoiceId
                        });
                    }
                } else if (q.dtype === 'multi-choice') {
                    if (state.selectedChoiceIds !== undefined) {
                        answers.push({
                            answerId: q.id,
                            dtype: 'multi-choice',
                            selectedChoiceIds: state.selectedChoiceIds
                        });
                    }
                } else if (q.dtype === 'text') {
                    if (state.value !== undefined && state.value !== null) {
                        answers.push({
                            answerId: q.id,
                            dtype: 'text',
                            value: state.value
                        });
                    }
                }
            });

            return { answers };
        },
        [submission, getAnswerValue]
    );

    const saveAnswers = useCallback(
        async (dataToSave = userEditsRef.current) => {
            if (!submissionId || isBlocked) return;

            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }

            const payload = buildSubmitPayload(dataToSave);
            if (payload.answers.length === 0) {
                setHasUnsavedChanges(false);
                return;
            }

            setIsSaving(true);
            try {
                await submitAnswersMutation({ submissionId, data: payload });
                setHasUnsavedChanges(false);
            } catch {
                setNotification({
                    open: true,
                    message: 'Ошибка при сохранении ответов',
                    severity: 'error'
                });
            } finally {
                setIsSaving(false);
            }
        },
        [submissionId, isBlocked, buildSubmitPayload, submitAnswersMutation]
    );

    const totalDurationSeconds = shortQuiz?.timeToComplete
        ? (() => {
              const parsed = parseIsoDuration(shortQuiz.timeToComplete);
              return getTotalDurationSeconds(parsed.hours, parsed.minutes, parsed.seconds);
          })()
        : 0;

    const hasTimeLimit = totalDurationSeconds > 0;

    const handleTimeExpiredInternal = useCallback(async () => {
        setIsTimeExpired(true);
        if (submission?.status === 'IN_PROCESS') {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }

            const payload = buildSubmitPayload(userEditsRef.current);
            if (payload.answers.length > 0) {
                try {
                    await submitAnswersMutation({ submissionId, data: payload });
                } catch (e) {
                    void e;
                }
            }

            try {
                await finishSubmissionMutation({ submissionId });
                await queryClient.invalidateQueries({
                    queryKey: getGetSubmissionQueryKey(submissionId)
                });
            } catch (e) {
                void e;
            }
        }
    }, [
        submission?.status,
        submissionId,
        buildSubmitPayload,
        submitAnswersMutation,
        finishSubmissionMutation,
        queryClient
    ]);

    useEffect(() => {
        if (!hasTimeLimit || !submission?.startedAt) {
            return;
        }

        const startTime = new Date(submission.startedAt).getTime();
        const endTime = startTime + totalDurationSeconds * 1000;

        const checkTime = () => {
            const now = Date.now();
            const diff = Math.max(0, Math.floor((endTime - now) / 1000));
            setRemainingSeconds(diff);

            if (diff <= 0) {
                handleTimeExpiredInternal();
            }
        };

        checkTime();
        const timer = setInterval(checkTime, 1000);

        return () => clearInterval(timer);
    }, [hasTimeLimit, totalDurationSeconds, submission?.startedAt, handleTimeExpiredInternal]);

    const handleAnswerChange = (answerId: string, newVal: AnswerValueState) => {
        if (isBlocked) return;

        setUserEdits((prev) => {
            const next = { ...prev, [answerId]: newVal };
            setHasUnsavedChanges(true);

            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
                saveAnswers(next);
            }, 1000);

            return next;
        });
    };

    const handleManualFinish = async () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }

        setIsFinishing(true);
        try {
            if (hasUnsavedChanges) {
                const payload = buildSubmitPayload(userEditsRef.current);
                if (payload.answers.length > 0) {
                    await submitAnswersMutation({ submissionId, data: payload });
                    setHasUnsavedChanges(false);
                }
            }

            await finishSubmissionMutation({ submissionId });
            await queryClient.invalidateQueries({
                queryKey: getGetSubmissionQueryKey(submissionId)
            });

            setNotification({
                open: true,
                message: 'Попытка завершена. Запущена оценка результатов.',
                severity: 'info'
            });
        } catch {
            setNotification({
                open: true,
                message: 'Ошибка при завершении попытки',
                severity: 'error'
            });
        } finally {
            setIsFinishing(false);
            setFinishDialogOpen(false);
        }
    };

    const handleOpenHintDialog = (answerId: string, penalty: number, remainingCount: number) => {
        setHintDialogState({
            open: true,
            answerId,
            penalty,
            remainingCount
        });
    };

    const handleConfirmRevealHint = async () => {
        if (!hintDialogState.answerId || !submissionId) return;

        try {
            await revealHintMutation({
                submissionId,
                data: { answerId: hintDialogState.answerId }
            });
            await queryClient.invalidateQueries({
                queryKey: getGetSubmissionQueryKey(submissionId)
            });
            setNotification({
                open: true,
                message: `Подсказка успешно открыта (штраф: -${hintDialogState.penalty} б.)`,
                severity: 'info'
            });
        } catch {
            setNotification({
                open: true,
                message: 'Не удалось открыть подсказку',
                severity: 'error'
            });
        } finally {
            setHintDialogState((prev) => ({ ...prev, open: false }));
        }
    };

    const formatTimer = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    if (isSubmissionLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <CircularProgress />
            </Box>
        );
    }

    if (submissionError || !submission) {
        return (
            <Container sx={{ mt: 4 }}>
                <Alert severity="error">Попытка не найдена или произошла ошибка загрузки</Alert>
                <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate('/')}>
                    На главную
                </Button>
            </Container>
        );
    }

    const isEvaluating =
        submission.status === 'SCORING' || submission.status === 'COMPLETING';
    const isFinished = submission.status === 'FINISHED';

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Paper
                elevation={2}
                sx={{
                    p: 2,
                    mb: 3,
                    position: 'sticky',
                    top: 16,
                    zIndex: 10,
                    bgcolor: 'background.paper',
                    backdropFilter: 'blur(8px)'
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 2
                    }}
                >
                    <Box>
                        <Typography variant="h6" component="div">
                            {shortQuiz?.name || 'Прохождение теста'}
                        </Typography>
                        {shortQuiz?.description && (
                            <Typography variant="body2" color="text.secondary">
                                {shortQuiz.description}
                            </Typography>
                        )}
                    </Box>

                    <Stack direction="row" spacing={1.5} alignItems="center">
                        {hasTimeLimit && remainingSeconds !== null && (
                            <Chip
                                icon={<TimerIcon />}
                                label={formatTimer(remainingSeconds)}
                                color={
                                    remainingSeconds <= 60
                                        ? 'error'
                                        : remainingSeconds <= 300
                                          ? 'warning'
                                          : 'primary'
                                }
                                variant={remainingSeconds <= 60 ? 'filled' : 'outlined'}
                                sx={{ fontWeight: 600, fontSize: '0.95rem', py: 2 }}
                            />
                        )}

                        {!isBlocked && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {isSaving ? (
                                    <Chip
                                        size="small"
                                        icon={<CircularProgress size={14} color="inherit" />}
                                        label="Сохранение..."
                                    />
                                ) : hasUnsavedChanges ? (
                                    <Chip
                                        size="small"
                                        color="warning"
                                        label="Не сохранено"
                                    />
                                ) : (
                                    <Chip
                                        size="small"
                                        color="success"
                                        icon={<CheckCircleIcon fontSize="small" />}
                                        label="Сохранено"
                                    />
                                )}

                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<SaveIcon />}
                                    disabled={!hasUnsavedChanges || isSaving}
                                    onClick={() => saveAnswers()}
                                >
                                    Сохранить
                                </Button>

                                <Button
                                    size="small"
                                    variant="contained"
                                    color="error"
                                    endIcon={<SendIcon />}
                                    disabled={isFinishing}
                                    onClick={() => setFinishDialogOpen(true)}
                                >
                                    Завершить
                                </Button>
                            </Box>
                        )}
                    </Stack>
                </Box>
            </Paper>

            {isEvaluating && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Идет оценивание ответов...
                    </Typography>
                    <Typography variant="body2">
                        Пожалуйста, подождите. Баллы за ответы обновляются автоматически.
                    </Typography>
                    <LinearProgress sx={{ mt: 1.5 }} />
                </Alert>
            )}

            {isFinished && (
                <Card sx={{ mb: 3, bgcolor: 'rgba(46, 125, 50, 0.04)', borderColor: 'success.main', borderWidth: 2 }} variant="outlined">
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <EmojiEventsIcon color="success" sx={{ fontSize: 40 }} />
                            <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="h5" fontWeight={600} color="success.dark">
                                    Тест завершен!
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Все ответы проверены и оценены. Ниже доступны результаты и правильные ответы.
                                </Typography>
                            </Box>
                            {submission.score !== null && submission.score !== undefined && (
                                <Chip
                                    label={`Итоговый балл: ${submission.score}`}
                                    color="success"
                                    sx={{ fontSize: '1.2rem', py: 2.5, px: 1, fontWeight: 700 }}
                                />
                            )}
                        </Box>

                        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                startIcon={<ArrowBackIcon />}
                                onClick={() => navigate(`/quizzes/${submission.quizId}`)}
                            >
                                К описанию теста
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => navigate('/')}
                            >
                                На главную
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {isTimeExpired && !isFinished && !isEvaluating && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Время, отведенное на тест, истекло. Редактирование ответов заблокировано.
                </Alert>
            )}

            <Box>
                {submission.answers.map((answer, index) => {
                    const answerValue = getAnswerValue(answer);
                    return (
                        <SubmissionAnswerCard
                            key={answer.id}
                            answer={answer}
                            questionIndex={index}
                            value={answerValue}
                            onChange={(newVal) => handleAnswerChange(answer.id, newVal)}
                            isBlocked={isBlocked}
                            submissionStatus={submission.status}
                            onRevealHint={handleOpenHintDialog}
                            isRevealingHint={isRevealingHint}
                        />
                    );
                })}
            </Box>

            {!isBlocked && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<SaveIcon />}
                        disabled={!hasUnsavedChanges || isSaving}
                        onClick={() => saveAnswers()}
                    >
                        Сохранить ответы
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        size="large"
                        endIcon={<SendIcon />}
                        disabled={isFinishing}
                        onClick={() => setFinishDialogOpen(true)}
                    >
                        Завершить попытку
                    </Button>
                </Box>
            )}

            <Dialog
                open={finishDialogOpen}
                onClose={() => setFinishDialogOpen(false)}
            >
                <DialogTitle>Завершить попытку?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Вы уверены, что хотите завершить тест? После завершения изменение ответов будет
                        невозможно. Будет запущена автоматическая оценка ваших результатов.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setFinishDialogOpen(false)} disabled={isFinishing}>
                        Отмена
                    </Button>
                    <Button
                        onClick={handleManualFinish}
                        color="error"
                        variant="contained"
                        disabled={isFinishing}
                    >
                        {isFinishing ? <CircularProgress size={20} color="inherit" /> : 'Завершить тест'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={hintDialogState.open}
                onClose={() => setHintDialogState((prev) => ({ ...prev, open: false }))}
            >
                <DialogTitle>Открыть подсказку?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Открытие подсказки приведет к штрафу в размере{' '}
                        <strong>{hintDialogState.penalty} б.</strong> от максимального балла за данный
                        вопрос.
                    </DialogContentText>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Останется доступных подсказок для этого вопроса:{' '}
                        {hintDialogState.remainingCount - 1}.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setHintDialogState((prev) => ({ ...prev, open: false }))}
                        disabled={isRevealingHint}
                    >
                        Отмена
                    </Button>
                    <Button
                        onClick={handleConfirmRevealHint}
                        color="warning"
                        variant="contained"
                        disabled={isRevealingHint}
                    >
                        {isRevealingHint ? <CircularProgress size={20} color="inherit" /> : 'Открыть'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={notification.open}
                autoHideDuration={4000}
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
        </Container>
    );
};
