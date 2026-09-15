import express from 'express';
import cors from 'cors';
import pool from './db/connection';
import patientRouter from './routers/patient.router';
import doctorRouter from './routers/doctor.router';
import specialtyRouter from './routers/specialty.router';
import clinicServiceRouter from './routers/clinic-service.router';
import locationRouter from './routers/location.router';
import appointmentRouter from './routers/appointment.router';
import doctorReviewRouter from './routers/doctor-review.router';
import { MailService } from './mail/mail.service';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'VitaMed backend radi!' });
});

app.use('/api/patients', patientRouter);
app.use('/api/doctors', doctorRouter);
app.use('/api/specialties', specialtyRouter);
app.use('/api/services', clinicServiceRouter);
app.use('/api/locations', locationRouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/doctor-reviews', doctorReviewRouter);

app.listen(3000, () => {
    console.log('VitaMed server pokrenut na portu 3000');
    void new MailService().verifyAtStartup();
});