import type { GetServerSideProps } from 'next'

export default function LogoutCallback() {
  return null
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/api/auth/logout/continue',
    permanent: false
  }
})
