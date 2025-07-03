"use client";
import React, { useState } from 'react';
import {
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { House, Apartment, Resident } from '../types';
import { supabase } from '../../../lib/supabaseClient';

interface HousingAccordionProps {
  microdistricts: string[];
}

const initialRegistrationForm = { first_name: '', last_name: '', phone: '', move_in_date: new Date().toISOString().split('T')[0] };

export default function HousingAccordion({ microdistricts }: HousingAccordionProps) {
  const [houses, setHouses] = useState<House[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);

  const [loadingHouses, setLoadingHouses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [openAptId, setOpenAptId] = useState<number | null>(null);
  const [registrationForm, setRegistrationForm] = useState(initialRegistrationForm);
  const [registrationFormErrors, setRegistrationFormErrors] = useState({ first_name: '', last_name: '', phone: '' });

  const handleAccordionChange = (microdistrict: string) => async (event: React.SyntheticEvent, isExpanded: boolean) => {
    if (isExpanded) {
      setLoadingHouses(true);
      setError(null);
      const { data: housesData, error: housesErr } = await supabase.from('houses').select('*, apartments(*, residents(*))').eq('microdistrict', microdistrict);
      if (housesErr) {
        setError(housesErr.message);
      } else {
        const allApartments: Apartment[] = housesData.flatMap((h: House) => h.apartments || []);
        const allResidents: Resident[] = allApartments.flatMap((a: Apartment) => a.residents || []);
        setHouses(prev => [...prev.filter((h: House) => h.microdistrict !== microdistrict), ...housesData]);
        setApartments(prev => [...prev.filter((a: Apartment) => !allApartments.some((na: Apartment) => na.id === a.id)), ...allApartments]);
        setResidents(prev => [...prev.filter((r: Resident) => !allResidents.some((nr: Resident) => nr.id === r.id)), ...allResidents]);
      }
      setLoadingHouses(false);
    }
  };

  const getResident = (apartmentId: number) => residents.find(r => r.apartment_id === apartmentId);

  const validateRegistration = () => {
    const errors = { first_name: '', last_name: '', phone: '' };
    let isValid = true;
    if (!registrationForm.first_name.trim()) { errors.first_name = 'Введите имя'; isValid = false; }
    if (!registrationForm.last_name.trim()) { errors.last_name = 'Введите фамилию'; isValid = false; }
    if (!registrationForm.phone.trim()) { errors.phone = 'Введите телефон'; isValid = false; }
    setRegistrationFormErrors(errors);
    return isValid;
  };

  const handleRegistration = async (apartmentId: number) => {
    if (!validateRegistration()) return;
    setSaving(true);
    setError(null);
    const { data: newResident, error: insertErr } = await supabase.from('residents').insert([{ ...registrationForm, apartment_id: apartmentId }]).select().single();
    if (insertErr) {
      setError(insertErr.message);
    } else if (newResident) {
      setResidents(prev => [...prev, newResident]);
      setRegistrationForm(initialRegistrationForm);
      setOpenAptId(null);
    }
    setSaving(false);
  };

  const handleEvict = async (residentId: number) => {
    setSaving(true);
    setError(null);
    const { error: delErr } = await supabase.from('residents').delete().eq('id', residentId);
    if (delErr) {
      setError(delErr.message);
    } else {
      setResidents(prev => prev.filter(r => r.id !== residentId));
    }
    setSaving(false);
  };

  const handleOpenRegistrationForm = (aptId: number) => {
    setRegistrationForm(initialRegistrationForm);
    setRegistrationFormErrors({ first_name: '', last_name: '', phone: '' });
    setOpenAptId(aptId);
  };

  const getApartmentsByHouseAndFloor = (houseId: number) => {
    return apartments
      .filter(apt => apt.house_id === houseId)
      .reduce((acc, apt) => {
        if (!acc[apt.floor]) acc[apt.floor] = [];
        acc[apt.floor].push(apt);
        return acc;
      }, {} as Record<number, Apartment[]>);
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {microdistricts.map((microdistrict) => (
        <Accordion key={microdistrict} onChange={handleAccordionChange(microdistrict)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="h6">{microdistrict}</Typography></AccordionSummary>
          <AccordionDetails>
            {loadingHouses && <CircularProgress />}
            {houses.filter(h => h.microdistrict === microdistrict).map(house => (
              <Accordion key={house.id}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Дом {house.house_number}</Typography></AccordionSummary>
                <AccordionDetails>
                  {Object.entries(getApartmentsByHouseAndFloor(house.id)).map(([floor, apts]) => (
                    <Accordion key={floor}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Этаж {floor} ({apts.length} кв.)</Typography></AccordionSummary>
                      <AccordionDetails sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {apts.map(apt => {
                          const resident = getResident(apt.id);
                          const isFormOpen = openAptId === apt.id;
                          return (
                            <Paper key={apt.id} elevation={2} sx={{ p: 2, width: isFormOpen ? 300 : 180, background: resident ? '#e8f5e9' : '#fff' }}>
                              <Typography variant="subtitle1" align="center">Кв. {apt.apartment_num}</Typography>
                              {resident ? (
                                <Box sx={{textAlign: 'center', mt: 1}}>
                                  <Typography sx={{fontWeight: 'bold'}}>{resident.last_name} {resident.first_name}</Typography>
                                  <Typography variant="body2" color="text.secondary">{resident.phone}</Typography>
                                  <Button
                                  sx={{mt: 1}}
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  onClick={() => {
                                    if (window.confirm(`Вы уверены, что хотите удалить ${resident.first_name} ${resident.last_name}?`)) {
                                      handleEvict(resident.id);
                                    }
                                  }}
                                >
                                  Удалить
                                </Button>
                                </Box>
                              ) : (
                                isFormOpen ? (
                                  <Box component="form" noValidate onSubmit={e => { e.preventDefault(); handleRegistration(apt.id); }} sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                                    <TextField autoFocus size="small" label="Имя" value={registrationForm.first_name} onChange={e => setRegistrationForm(f => ({ ...f, first_name: e.target.value }))} required error={!!registrationFormErrors.first_name} helperText={registrationFormErrors.first_name} />
                                    <TextField size="small" label="Фамилия" value={registrationForm.last_name} onChange={e => setRegistrationForm(f => ({ ...f, last_name: e.target.value }))} required error={!!registrationFormErrors.last_name} helperText={registrationFormErrors.last_name} />
                                    <TextField size="small" label="Телефон" value={registrationForm.phone} onChange={e => setRegistrationForm(f => ({ ...f, phone: e.target.value }))} required error={!!registrationFormErrors.phone} helperText={registrationFormErrors.phone} />
                                    <TextField size="small" type="date" InputLabelProps={{ shrink: true }} value={registrationForm.move_in_date} onChange={e => setRegistrationForm(f => ({ ...f, move_in_date: e.target.value }))} required />
                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                      <Button type="submit" size="small" variant="contained" disabled={saving}>{saving ? <CircularProgress size={14}/> : 'Ок'}</Button>
                                      <Button size="small" onClick={() => setOpenAptId(null)}>Отмена</Button>
                                    </Box>
                                  </Box>
                                ) : (
                                  <Button sx={{mt: 1}} fullWidth variant="outlined" onClick={() => handleOpenRegistrationForm(apt.id)}>Зарегистрировать</Button>
                                )
                              )}
                            </Paper>
                          )
                        })}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
