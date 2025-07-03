"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Container, Typography, CircularProgress } from '@mui/material';
import ResidentsTable from "./components/ResidentsTable";
import AddHouseForm from "./components/AddHouseForm";
import HousingAccordion from './components/HousingAccordion';
import Dashboard from './components/Dashboard';

const initialAddHouseForm = { microdistrict: '', house_number: '', floors_count: 5 };

// Main Component
function Home() {
  // Состояние для хранения списка микрорайонов
  const [microdistricts, setMicrodistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Состояния для формы добавления дома
  const [addHouseForm, setAddHouseForm] = useState(initialAddHouseForm);
  const [addHouseFormErrors, setAddHouseFormErrors] = useState({ microdistrict: '', house_number: '', floors_count: '' });

  // Загружаем только уникальные микрорайоны при первом рендере
  const fetchMicrodistricts = async () => {
    setLoading(true);
    // Используем RPC для получения уникальных значений
    const { data, error } = await supabase.rpc('get_unique_microdistricts');

    if (error) {
      setError(error.message);
    } else if (data) {
      // Преобразуем массив объектов в массив строк
      const districtNames = data.map((item: { microdistrict: string }) => item.microdistrict);
      setMicrodistricts(districtNames);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMicrodistricts(); }, []);

  const validateAddHouse = () => {
    const errors = { microdistrict: '', house_number: '', floors_count: '' };
    let isValid = true;
    if (!addHouseForm.microdistrict.trim()) {
      errors.microdistrict = 'Обязательное поле';
      isValid = false;
    }
    if (!addHouseForm.house_number.trim()) {
      errors.house_number = 'Обязательное поле';
      isValid = false;
    }
    if (addHouseForm.floors_count <= 0) {
      errors.floors_count = 'Должно быть больше 0';
      isValid = false;
    }
    setAddHouseFormErrors(errors);
    return isValid;
  };

  const handleAddHouse = async () => {
    if (!validateAddHouse()) return;

    setSaving(true);
    setError(null);

    // Проверка на дубликат
    const { data: existingHouse, error: checkErr } = await supabase
      .from('houses')
      .select('id')
      .eq('microdistrict', addHouseForm.microdistrict.trim())
      .eq('house_number', addHouseForm.house_number.trim())
      .single();

    if (checkErr && checkErr.code !== 'PGRST116') { // PGRST116 - no rows found, which is what we want
      setError(checkErr.message);
      setSaving(false);
      return;
    }

    if (existingHouse) {
      setError('Этот дом уже существует в данном микрорайоне.');
      setSaving(false);
      return;
    }

    const { data: newHouse, error: houseErr } = await supabase.from('houses').insert([{ ...addHouseForm }]).select();

    if (houseErr) {
      setError(houseErr.message);
      setSaving(false);
      return;
    }

    if (newHouse && newHouse.length > 0) {
      const houseId = newHouse[0].id;
      const newApartments = [];
      for (let floor = 1; floor <= addHouseForm.floors_count; floor++) {
        for (let apt = 1; apt <= 6; apt++) {
          newApartments.push({ house_id: houseId, floor: floor, apartment_num: apt });
        }
      }
      const { error: aptErr } = await supabase.from('apartments').insert(newApartments);
      if (aptErr) {
        setError(aptErr.message);
      } else {
        setAddHouseForm(initialAddHouseForm);
        // Перезагружаем список микрорайонов, если был добавлен новый
        if (!microdistricts.includes(addHouseForm.microdistrict)) {
            fetchMicrodistricts();
        }
        // TODO: Need to refresh the accordion view as well
      }
    }
    setSaving(false);
  };





  return (
    <Container sx={{ mt: 4, mb: 4 }}>
      <Dashboard />

      <AddHouseForm 
        form={addHouseForm}
        setForm={setAddHouseForm}
        errors={addHouseFormErrors}
        handleSubmit={handleAddHouse}
        saving={saving}
        error={error}
      />

      <Typography variant="h4" gutterBottom>Список домов</Typography>
      {loading ? <CircularProgress /> : (
        <HousingAccordion microdistricts={microdistricts} />
      )}

      {/* TODO: ResidentsTable needs to fetch its own data now */}
      <ResidentsTable />
    </Container>
  );
}

export default Home;
