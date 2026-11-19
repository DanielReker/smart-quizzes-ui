import {useState} from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Container,
    Grid,
    Paper,
    Snackbar,
    Stack,
    Typography
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TimerIcon from '@mui/icons-material/Timer';
import RepeatIcon from '@mui/icons-material/Repeat';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {useNavigate, useParams} from 'react-router';
import {useCreateSubmission, useGetQuizShort} from '../api/generated';
import QuizStatus from '../components/QuizStatus.tsx';
import {formatHumanDuration, parseIsoDuration} from '../utils/duration.ts';

export const TakeQuizPage = () => {
    const { quizId: id } = useParams<{ quizId: string }>();

    if (!id) {
        throw new Error('Missing quizId param');
    }

    const navigate = useNavigate();

    const [notification, setNotification] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error';
    }>({
        open: false,
        message: '',
        severity: 'success'
    });

    const { data: quiz, isLoading, error } = useGetQuizShort(id);
    const { mutateAsync: startSubmission, isPending: isStarting } = useCreateSubmission();

    const handleStartAttempt = async () => {
        try {
            const submission = await startSubmission({ quizId: id });
            navigate(`/submissions/${submission.id}`);
        } catch {
            setNotification({
                open: true,
                message: 'Не удалось начать попытку. Возможно, исчерпан лимит попыток или возникла ошибка.',
                severity: 'error'
            });
        }
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error || !quiz) {
        return (
            <Container sx={{ mt: 4 }}>
                <Alert severity="error">Тест не найден</Alert>
                <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate('/')}>
                    На главную
                </Button>
            </Container>
        );
    }

    if (quiz.status === 'DRAFT') {
        return (
            <Container maxWidth="sm" sx={{ mt: 6 }}>
                <Card sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h5" gutterBottom>
                        Тест ещё не начался
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Данный тест находится в статусе черновика и пока недоступен для прохождения.
                    </Typography>
                    <Stack direction="row" spacing={2} justifyContent="center">
                        <Button variant="outlined" onClick={() => navigate('/')}>
                            На главную
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => navigate(`/quizzes/${id}/edit`)}
                        >
                            Перейти к редактированию
                        </Button>
                    </Stack>
                </Card>
            </Container>
        );
    }

    if (quiz.status === 'FINISHED') {
        return (
            <Container maxWidth="sm" sx={{ mt: 6 }}>
                <Card sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h5" gutterBottom>
                        Тест уже завершён
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Прием ответов на этот тест окончен.
                    </Typography>
                    <Stack direction="row" spacing={2} justifyContent="center">
                        <Button variant="outlined" onClick={() => navigate('/')}>
                            На главную
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => navigate(`/quizzes/${id}/stats`)}
                        >
                            Просмотреть статистику
                        </Button>
                    </Stack>
                </Card>
            </Container>
        );
    }

    const duration = parseIsoDuration(quiz.timeToComplete);
    const formattedDuration = quiz.timeToComplete
        ? formatHumanDuration(duration.hours, duration.minutes, duration.seconds)
        : 'Не ограничено';

    return (
        <Container maxWidth="md" sx={{ py: 6 }}>
            <Button
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/')}
                sx={{ mb: 2 }}
            >
                Все тесты
            </Button>

            <Card elevation={2}>
                <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Typography variant="h4" component="h1" fontWeight={700}>
                            {quiz.name}
                        </Typography>
                        <QuizStatus status={quiz.status} />
                    </Box>

                    {quiz.description && (
                        <Typography
                            variant="body1"
                            color="text.secondary"
                            sx={{ mb: 4, whiteSpace: 'pre-line' }}
                        >
                            {quiz.description}
                        </Typography>
                    )}

                    <Grid container spacing={2} sx={{ mb: 4 }}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <Paper
                                variant="outlined"
                                sx={{ p: 2.5, textAlign: 'center', borderRadius: 2 }}
                            >
                                <HelpOutlineIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                    Количество вопросов
                                </Typography>
                                <Typography variant="h6" fontWeight={600}>
                                    {quiz.numberOfQuestions}
                                </Typography>
                            </Paper>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 4 }}>
                            <Paper
                                variant="outlined"
                                sx={{ p: 2.5, textAlign: 'center', borderRadius: 2 }}
                            >
                                <TimerIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                    Время на прохождение
                                </Typography>
                                <Typography variant="h6" fontWeight={600}>
                                    {formattedDuration}
                                </Typography>
                            </Paper>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 4 }}>
                            <Paper
                                variant="outlined"
                                sx={{ p: 2.5, textAlign: 'center', borderRadius: 2 }}
                            >
                                <RepeatIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                    Количество попыток
                                </Typography>
                                <Typography variant="h6" fontWeight={600}>
                                    {quiz.maxAttempts ? quiz.maxAttempts : 'Не ограничено'}
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={
                                isStarting ? (
                                    <CircularProgress size={22} color="inherit" />
                                ) : (
                                    <PlayArrowIcon />
                                )
                            }
                            disabled={isStarting}
                            onClick={handleStartAttempt}
                            sx={{ px: 5, py: 1.8, fontSize: '1.1rem', borderRadius: 2 }}
                        >
                            {isStarting ? 'Создание попытки...' : 'Начать попытку'}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

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
        </Container>
    );
};