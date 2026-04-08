-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.Contaminants (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  Name text,
  image_url text text,
  info_url text,
  CONSTRAINT Contaminants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.Locations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  Location text,
  Map Coordinates text,
  CONSTRAINT Locations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.Matrix (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  Name text,
  icon_url text,
  category integer,
  CONSTRAINT Matrix_pkey PRIMARY KEY (id),
  CONSTRAINT Matrix_category_fkey FOREIGN KEY (category) REFERENCES public.Matrix Categories(id)
);
CREATE TABLE public.Matrix Categories (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  Categories text,
  CONSTRAINT Matrix Categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.NCP Reports (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  Project Lead text,
  funding_start_year text,
  funding_end_year text,
  Location bigint,
  Matrix bigint,
  Contaminant bigint,
  summary text,
  URL text,
  Saved to Google text,
  Project Title text,
  CONSTRAINT NCP Reports_pkey PRIMARY KEY (id),
  CONSTRAINT NCP Reports_Location_fkey FOREIGN KEY (Location) REFERENCES public.Locations(id),
  CONSTRAINT NCP Reports_Matrix_fkey FOREIGN KEY (Matrix) REFERENCES public.Matrix(id),
  CONSTRAINT NCP Reports_Contaminant_fkey FOREIGN KEY (Contaminant) REFERENCES public.Contaminants(id)
);
CREATE TABLE public.PDC (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  Project Lead text,
  Year integer,
  Project Title text,
  Location bigint,
  Saved to Google text,
  CONSTRAINT PDC_pkey PRIMARY KEY (id),
  CONSTRAINT PDC_Location_fkey FOREIGN KEY (Location) REFERENCES public.Locations(id)
);
CREATE TABLE public.Publication Types (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  Type text,
  CONSTRAINT Publication Types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.Publications (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  Lead Authors text,
  Year numeric,
  Publication type bigint,
  Title text,
  Location bigint,
  Matrix _Animal Type bigint,
  Contaminants bigint,
  Abstract/Summary text,
  URL text,
  PDF saved to google text,
  CONSTRAINT Publications_pkey PRIMARY KEY (id),
  CONSTRAINT Publications_Location_fkey FOREIGN KEY (Location) REFERENCES public.Locations(id),
  CONSTRAINT Publications_Matrix _Animal Type_fkey FOREIGN KEY (Matrix _Animal Type) REFERENCES public.Matrix(id),
  CONSTRAINT Publications_Contaminants_fkey FOREIGN KEY (Contaminants) REFERENCES public.Contaminants(id),
  CONSTRAINT Publications_Publication type_fkey FOREIGN KEY (Publication type) REFERENCES public.Publication Types(id)
);